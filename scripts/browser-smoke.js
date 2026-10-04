const fs = require("fs");

const port = Number(process.argv[2] || 9223);
const output = process.argv[3] || ".agent-data/agent-results.png";

async function getTarget() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const target = targets.find((item) => item.type === "page" && item.url.includes("agent.html"));
      if (target) return target;
    } catch (_) {
      // Chrome may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Could not find the agent page in the Chrome debugging targets");
}

async function main() {
  const target = await getTarget();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let commandId = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    commandId += 1;
    pending.set(commandId, { resolve, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });

  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  const expression = `
    (async () => {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({message: '物理类560分，想学计算机，优先北京或内蒙古', per_tier: 3})
      });
      const data = await response.json();
      syncProfile(data.profile);
      renderRecommendations(data);
      renderSources(data.sources || []);
      renderTrace(data.trace || []);
      document.querySelector('#recommendationSection').scrollIntoView({block: 'start'});
      return {status: response.status, counts: Object.fromEntries(Object.entries(data.recommendations).map(([key, value]) => [key, value.length]))};
    })()
  `;
  const evaluated = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  const value = evaluated.result?.value;
  if (!value || value.status !== 200) throw new Error(`Page smoke request failed: ${JSON.stringify(value)}`);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(output, Buffer.from(screenshot.data, "base64"));
  socket.close();
  console.log(JSON.stringify(value));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
