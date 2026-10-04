const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dataRoot = path.join(rootDir, "plan-comparison");
const outputPath = path.join(rootDir, "plan-comparison-report.html");

const batches = [
  {
    id: "undergraduate",
    label: "本科批",
    y2025: {
      dir: "2025-undergraduate",
      source: "https://www.nm.zsks.cn/25gkwb/25zsjh/gkjh_25_3_0628/jh/jhkl.html",
    },
    y2026: {
      dir: "2026-undergraduate",
      source: "https://www.nm.zsks.cn/26gkwb/26zsjh/gkjh_26_3/jh/jhkl.html",
    },
  },
  {
    id: "vocational",
    label: "高职（专科）批",
    y2025: {
      dir: "2025-vocational",
      source: "https://www.nm.zsks.cn/25gkwb/25zsjh/gkjh_25_711/jh/jhkl.html",
    },
    y2026: {
      dir: "2026-vocational",
      source: "https://www.nm.zsks.cn/26gkwb/26zsjh/gkjh_26_7/jh/jhkl.html",
    },
  },
];

const schoolChangeEvidence = {
  "赤峰大学": {
    status: "更名",
    predecessor: "赤峰学院",
    basis: "联网核验：赤峰学院更名为赤峰大学；2025本科批中存在赤峰学院。",
    source: "https://baike.baidu.com/item/%E8%B5%A4%E5%B3%B0%E5%A4%A7%E5%AD%A6",
  },
  "应急管理大学": {
    status: "合并组建",
    predecessor: "华北科技学院、防灾科技学院",
    basis: "联网核验：华北科技学院、防灾科技学院合并组建应急管理大学；2025本科批中两校均有招生。",
    source: "https://baike.baidu.com/item/%E5%BA%94%E6%80%A5%E7%AE%A1%E7%90%86%E5%A4%A7%E5%AD%A6",
  },
  "湖州师范大学": {
    status: "更名",
    predecessor: "湖州师范学院",
    basis: "联网核验：湖州师范学院更名为湖州师范大学；2025本科批中存在湖州师范学院。",
    source: "https://baike.baidu.com/item/%E6%B9%96%E5%B7%9E%E5%B8%88%E8%8C%83%E5%A4%A7%E5%AD%A6",
  },
  "闽江大学": {
    status: "更名",
    predecessor: "闽江学院",
    basis: "联网核验：闽江学院更名为闽江大学；2025本科批中存在闽江学院。",
    source: "https://baike.baidu.com/item/%E9%97%BD%E6%B1%9F%E5%A4%A7%E5%AD%A6",
  },
  "绍兴大学": {
    status: "更名",
    predecessor: "绍兴文理学院",
    basis: "联网核验：绍兴文理学院更名为绍兴大学。",
    source: "https://baike.baidu.com/item/%E7%BB%8D%E5%85%B4%E5%A4%A7%E5%AD%A6",
  },
  "榆林大学": {
    status: "更名",
    predecessor: "榆林学院",
    basis: "联网核验：榆林学院更名为榆林大学；2025本科批中存在榆林学院。",
    source: "https://baike.baidu.com/item/%E6%A6%86%E6%9E%97%E5%A4%A7%E5%AD%A6",
  },
  "安徽科技工程大学": {
    status: "更名",
    predecessor: "安徽科技学院",
    basis: "联网核验：安徽科技学院更名为安徽科技工程大学。",
    source: "https://baike.baidu.com/item/%E5%AE%89%E5%BE%BD%E7%A7%91%E6%8A%80%E5%B7%A5%E7%A8%8B%E5%A4%A7%E5%AD%A6",
  },
  "淮安大学": {
    status: "更名",
    predecessor: "淮阴工学院",
    basis: "联网核验：淮阴工学院更名为淮安大学。",
    source: "https://baike.baidu.com/item/%E6%B7%AE%E5%AE%89%E5%A4%A7%E5%AD%A6",
  },
  "湖南理工大学": {
    status: "更名",
    predecessor: "湖南理工学院",
    basis: "联网核验：湖南理工学院更名为湖南理工大学；2025本科批中存在湖南理工学院。",
    source: "https://baike.baidu.com/item/%E6%B9%96%E5%8D%97%E7%90%86%E5%B7%A5%E5%A4%A7%E5%AD%A6",
  },
  "重庆工业职业技术大学": {
    status: "升格更名",
    predecessor: "重庆工业职业技术学院",
    basis: "联网核验：重庆工业职业技术学院升格更名为重庆工业职业技术大学。",
    source: "https://baike.baidu.com/item/%E9%87%8D%E5%BA%86%E5%B7%A5%E4%B8%9A%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "河南工业职业技术大学": {
    status: "升格更名",
    predecessor: "河南工业职业技术学院",
    basis: "联网核验：河南工业职业技术学院升格更名为河南工业职业技术大学。",
    source: "https://baike.baidu.com/item/%E6%B2%B3%E5%8D%97%E5%B7%A5%E4%B8%9A%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "黄冈职业技术大学": {
    status: "升格更名",
    predecessor: "黄冈职业技术学院",
    basis: "联网核验：黄冈职业技术学院升格更名为黄冈职业技术大学。",
    source: "https://baike.baidu.com/item/%E9%BB%84%E5%86%88%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "山东商业职业技术大学": {
    status: "升格更名",
    predecessor: "山东商业职业技术学院",
    basis: "联网核验：山东商业职业技术学院升格更名为山东商业职业技术大学。",
    source: "https://baike.baidu.com/item/%E5%B1%B1%E4%B8%9C%E5%95%86%E4%B8%9A%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "湖北三峡职业技术大学": {
    status: "升格更名",
    predecessor: "湖北三峡职业技术学院",
    basis: "联网核验：湖北三峡职业技术学院升格更名为湖北三峡职业技术大学。",
    source: "https://baike.baidu.com/item/%E6%B9%96%E5%8C%97%E4%B8%89%E5%B3%A1%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "日照职业技术大学": {
    status: "升格更名",
    predecessor: "日照职业技术学院",
    basis: "联网核验：日照职业技术学院升格更名为日照职业技术大学。",
    source: "https://baike.baidu.com/item/%E6%97%A5%E7%85%A7%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "襄阳职业技术大学": {
    status: "升格更名",
    predecessor: "襄阳职业技术学院",
    basis: "联网核验：襄阳职业技术学院升格更名为襄阳职业技术大学。",
    source: "https://baike.baidu.com/item/%E8%A5%84%E9%98%B3%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "江苏建筑职业技术大学": {
    status: "升格更名",
    predecessor: "江苏建筑职业技术学院",
    basis: "联网核验：江苏建筑职业技术学院升格更名为江苏建筑职业技术大学。",
    source: "https://baike.baidu.com/item/%E6%B1%9F%E8%8B%8F%E5%BB%BA%E7%AD%91%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "重庆城市管理职业大学": {
    status: "升格更名",
    predecessor: "重庆城市管理职业学院",
    basis: "联网核验：重庆城市管理职业学院升格更名为重庆城市管理职业大学。",
    source: "https://baike.baidu.com/item/%E9%87%8D%E5%BA%86%E5%9F%8E%E5%B8%82%E7%AE%A1%E7%90%86%E8%81%8C%E4%B8%9A%E5%A4%A7%E5%AD%A6",
  },
  "江西外语外贸职业大学": {
    status: "升格更名",
    predecessor: "江西外语外贸职业学院",
    basis: "联网核验：江西外语外贸职业学院升格更名为江西外语外贸职业大学。",
    source: "https://baike.baidu.com/item/%E6%B1%9F%E8%A5%BF%E5%A4%96%E8%AF%AD%E5%A4%96%E8%B4%B8%E8%81%8C%E4%B8%9A%E5%A4%A7%E5%AD%A6",
  },
  "山东科技职业大学": {
    status: "升格更名",
    predecessor: "山东科技职业学院",
    basis: "联网核验：山东科技职业学院升格更名为山东科技职业大学。",
    source: "https://baike.baidu.com/item/%E5%B1%B1%E4%B8%9C%E7%A7%91%E6%8A%80%E8%81%8C%E4%B8%9A%E5%A4%A7%E5%AD%A6",
  },
  "四川建筑职业技术大学": {
    status: "升格更名",
    predecessor: "四川建筑职业技术学院",
    basis: "联网核验：四川建筑职业技术学院升格更名为四川建筑职业技术大学。",
    source: "https://baike.baidu.com/item/%E5%9B%9B%E5%B7%9D%E5%BB%BA%E7%AD%91%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "陕西工业职业技术大学": {
    status: "升格更名",
    predecessor: "陕西工业职业技术学院",
    basis: "联网核验：陕西工业职业技术学院升格更名为陕西工业职业技术大学。",
    source: "https://baike.baidu.com/item/%E9%99%95%E8%A5%BF%E5%B7%A5%E4%B8%9A%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "湖南化工职业技术大学": {
    status: "升格更名",
    predecessor: "湖南化工职业技术学院",
    basis: "联网核验：湖南化工职业技术学院升格更名为湖南化工职业技术大学。",
    source: "https://baike.baidu.com/item/%E6%B9%96%E5%8D%97%E5%8C%96%E5%B7%A5%E8%81%8C%E4%B8%9A%E6%8A%80%E6%9C%AF%E5%A4%A7%E5%AD%A6",
  },
  "豫章师范学院": {
    status: "2026新增招生",
    predecessor: "未发现对应2025目标批次招生院校",
    basis: "联网核验未标注为本次更名/合并；按本报告招生计划口径为2026新增招生院校。",
    source: "https://baike.baidu.com/item/%E8%B1%AB%E7%AB%A0%E5%B8%88%E8%8C%83%E5%AD%A6%E9%99%A2",
  },
  "大连工程学院": {
    status: "转设更名",
    predecessor: "大连理工大学城市学院",
    basis: "联网核验：大连理工大学城市学院转设为民办普通高校大连工程学院。",
    source: "https://zh.wikipedia.org/wiki/%E5%A4%A7%E8%BF%9E%E7%90%86%E5%B7%A5%E5%A4%A7%E5%AD%A6%E5%9F%8E%E5%B8%82%E5%AD%A6%E9%99%A2",
  },
  "新疆理工职业大学": {
    status: "新设高校/2026新增招生",
    predecessor: "2025年新设本科职业大学",
    basis: "联网核验：2025年经教育部批准成立；按本报告招生计划口径为2026新增招生。",
    source: "https://zh.wikipedia.org/wiki/%E6%96%B0%E7%96%86%E7%90%86%E5%B7%A5%E8%81%8C%E4%B8%9A%E5%A4%A7%E5%AD%A6",
  },
  "重庆三峡科技大学": {
    status: "更名",
    predecessor: "重庆三峡学院",
    basis: "联网核验：重庆三峡学院更名为重庆三峡科技大学。",
    source: "https://zh.wikipedia.org/wiki/%E9%87%8D%E5%BA%86%E4%B8%89%E5%B3%A1%E7%A7%91%E6%8A%80%E5%A4%A7%E5%AD%A6",
  },
  "山东医药大学": {
    status: "更名",
    predecessor: "滨州医学院",
    basis: "联网核验：滨州医学院更名为山东医药大学。",
    source: "https://zh.wikipedia.org/wiki/%E5%B1%B1%E4%B8%9C%E5%8C%BB%E8%8D%AF%E5%A4%A7%E5%AD%A6",
  },
};

function readJson(relativeDir, fileName) {
  const filePath = path.join(dataRoot, relativeDir, fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, " ");
}

function clean(value) {
  return stripHtml(value).replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return clean(value).normalize("NFKC").replace(/\s+/g, "");
}

function planCount(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

function brief(values, limit = 5) {
  const list = uniq(values);
  const visible = list.slice(0, limit).join("、");
  return list.length > limit ? `${visible} 等${list.length}项` : visible;
}

function addToMap(map, key, row, batchLabel, year) {
  const current = map.get(key) ?? {
    key,
    batch: batchLabel,
    year,
    seats: 0,
    rows: 0,
    school: clean(row.yxmc),
    schoolNorm: normalize(row.yxmc),
    schoolCodes: new Set(),
    category: clean(row.klmc),
    major: clean(row.zymc),
    majorNorm: normalize(row.zymc),
    planType: clean(row.jhlbmc),
    nature: clean(row.jhxzmc),
    groupCodes: new Set(),
    majorCodes: new Set(),
    duration: new Set(),
    fee: new Set(),
    requirement: new Set(),
    places: new Set(),
    notes: new Set(),
  };

  current.seats += planCount(row.syjh);
  current.rows += 1;
  current.schoolCodes.add(clean(row.yxdh));
  current.groupCodes.add(clean(row.jhzyzdm));
  current.majorCodes.add(clean(row.zydh));
  current.duration.add(clean(row.xznx));
  current.fee.add(clean(row.xf));
  current.requirement.add(clean(row.kskmyqzw));
  current.places.add(clean(row.bxdd));
  current.notes.add(clean(row.bz));
  map.set(key, current);
}

function compactGroup(group) {
  return {
    key: group.key,
    batch: group.batch,
    school: group.school,
    schoolCodes: brief([...group.schoolCodes], 4),
    category: group.category,
    major: group.major,
    planType: group.planType,
    nature: group.nature,
    seats: group.seats,
    rows: group.rows,
    groupCodes: brief([...group.groupCodes], 4),
    majorCodes: brief([...group.majorCodes], 6),
    duration: brief([...group.duration], 3),
    fee: brief([...group.fee], 3),
    requirement: brief([...group.requirement], 3),
    places: brief([...group.places], 2),
    notes: brief([...group.notes].map((item) => item.replace(/\s+/g, " ")), 1),
  };
}

function schoolKey(row) {
  return normalize(row.yxmc);
}

function majorNameKey(row) {
  return normalize(row.zymc);
}

function offeringKey(row, batchLabel) {
  return [
    batchLabel,
    normalize(row.yxmc),
    normalize(row.klmc),
    normalize(row.zymc),
    normalize(row.jhlbmc),
    normalize(row.jhxzmc),
  ].join("|");
}

function buildSchoolIndex(rows, batchLabel) {
  const map = new Map();
  for (const row of rows) {
    const key = schoolKey(row);
    if (!key) continue;
    const current = map.get(key) ?? {
      key,
      batch: batchLabel,
      school: clean(row.yxmc),
      schoolCodes: new Set(),
      seats: 0,
      rows: 0,
      majors: new Map(),
    };
    current.schoolCodes.add(clean(row.yxdh));
    current.seats += planCount(row.syjh);
    current.rows += 1;
    const major = clean(row.zymc);
    current.majors.set(major, (current.majors.get(major) ?? 0) + planCount(row.syjh));
    map.set(key, current);
  }
  return map;
}

function buildMajorNameIndex(rows, batchLabel) {
  const map = new Map();
  for (const row of rows) {
    const key = majorNameKey(row);
    if (!key) continue;
    const current = map.get(key) ?? {
      key,
      batch: batchLabel,
      major: clean(row.zymc),
      seats: 0,
      rows: 0,
      schools: new Map(),
      categories: new Set(),
    };
    current.seats += planCount(row.syjh);
    current.rows += 1;
    current.categories.add(clean(row.klmc));
    const school = clean(row.yxmc);
    current.schools.set(school, (current.schools.get(school) ?? 0) + planCount(row.syjh));
    map.set(key, current);
  }
  return map;
}

function buildOfferingIndex(rows, batchLabel, year) {
  const map = new Map();
  for (const row of rows) {
    const key = offeringKey(row, batchLabel);
    if (!key) continue;
    addToMap(map, key, row, batchLabel, year);
  }
  return map;
}

function topEntries(map, limit = 6) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hans-CN"))
    .slice(0, limit)
    .map(([name]) => name);
}

let all2025SchoolsCache;

function plainSchoolName(value) {
  return clean(value)
    .replace(/（.*?）/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/民办/g, "")
    .replace(/独立学院/g, "");
}

function getAll2025Schools() {
  if (!all2025SchoolsCache) {
    const rows = ["2025-undergraduate", "2025-vocational"].flatMap((dir) => readJson(dir, "jhzy.json"));
    all2025SchoolsCache = new Map();
    for (const row of rows) {
      const name = clean(row.yxmc);
      const key = normalize(plainSchoolName(name));
      if (!all2025SchoolsCache.has(key)) {
        all2025SchoolsCache.set(key, {
          school: name,
          batches: new Set(),
        });
      }
      all2025SchoolsCache.get(key).batches.add(clean(row.pcmc));
    }
  }
  return all2025SchoolsCache;
}

function annotateNewSchool(school) {
  const plainName = plainSchoolName(school.school);
  const evidence = schoolChangeEvidence[plainName] ?? schoolChangeEvidence[school.school];
  if (evidence) {
    return {
      status: evidence.status,
      predecessor: evidence.predecessor,
      basis: evidence.basis,
      source: evidence.source,
    };
  }

  const existing = getAll2025Schools().get(normalize(plainName));
  if (existing) {
    return {
      status: "2026新增到本批次招生",
      predecessor: existing.school,
      basis: `2025年已在${brief([...existing.batches], 3)}招生；2026年首次进入本报告当前批次。`,
      source: "本地下载的2025招生计划数据",
    };
  }

  return {
    status: "2026新增招生",
    predecessor: "未发现对应2025目标批次招生院校",
    basis: "未标注为已核验的合并、改名或升格；按本报告招生计划口径列为2026新增招生。",
    source: "本地下载的2025、2026招生计划数据",
  };
}

function compareBatch(batch) {
  const rows25 = readJson(batch.y2025.dir, "jhzy.json");
  const rows26 = readJson(batch.y2026.dir, "jhzy.json");

  const schools25 = buildSchoolIndex(rows25, batch.label);
  const schools26 = buildSchoolIndex(rows26, batch.label);
  const majors25 = buildMajorNameIndex(rows25, batch.label);
  const majors26 = buildMajorNameIndex(rows26, batch.label);
  const offerings25 = buildOfferingIndex(rows25, batch.label, "2025");
  const offerings26 = buildOfferingIndex(rows26, batch.label, "2026");

  const newSchools = [...schools26.values()]
    .filter((school) => !schools25.has(school.key))
    .map((school) => {
      const annotation = annotateNewSchool(school);
      return {
        batch: batch.label,
        schoolCodes: brief([...school.schoolCodes], 5),
        school: school.school,
        status: annotation.status,
        predecessor: annotation.predecessor,
        basis: annotation.basis,
        source: annotation.source,
        seats2026: school.seats,
        rows2026: school.rows,
        representativeMajors: brief(topEntries(school.majors, 8), 8),
      };
    })
    .sort((a, b) => b.seats2026 - a.seats2026 || a.school.localeCompare(b.school, "zh-Hans-CN"));

  const newMajorNames = [...majors26.values()]
    .filter((major) => !majors25.has(major.key))
    .map((major) => ({
      batch: batch.label,
      major: major.major,
      seats2026: major.seats,
      rows2026: major.rows,
      schoolCount: major.schools.size,
      categories: brief([...major.categories], 6),
      representativeSchools: brief(topEntries(major.schools, 8), 8),
    }))
    .sort((a, b) => b.seats2026 - a.seats2026 || a.major.localeCompare(b.major, "zh-Hans-CN"));

  const newOfferings = [...offerings26.entries()]
    .filter(([key]) => !offerings25.has(key))
    .map(([, group]) => {
      const item = compactGroup(group);
      return {
        batch: item.batch,
        category: item.category,
        schoolCodes: item.schoolCodes,
        school: item.school,
        major: item.major,
        seats2026: item.seats,
        planType: item.planType,
        nature: item.nature,
        groupCodes2026: item.groupCodes,
        majorCodes2026: item.majorCodes,
        duration: item.duration,
        fee: item.fee,
        requirement: item.requirement,
        places: item.places,
        notes: item.notes,
      };
    })
    .sort((a, b) => b.seats2026 - a.seats2026 || a.school.localeCompare(b.school, "zh-Hans-CN"));

  const increasedOfferings = [...offerings26.entries()]
    .filter(([key, group26]) => offerings25.has(key) && group26.seats > offerings25.get(key).seats)
    .map(([key, group26]) => {
      const group25 = compactGroup(offerings25.get(key));
      const item26 = compactGroup(group26);
      return {
        batch: item26.batch,
        category: item26.category,
        schoolCodes2025: group25.schoolCodes,
        schoolCodes2026: item26.schoolCodes,
        school: item26.school,
        major: item26.major,
        seats2025: group25.seats,
        seats2026: item26.seats,
        increase: item26.seats - group25.seats,
        planType: item26.planType,
        nature: item26.nature,
        groupCodes2025: group25.groupCodes,
        groupCodes2026: item26.groupCodes,
        majorCodes2025: group25.majorCodes,
        majorCodes2026: item26.majorCodes,
      };
    })
    .sort((a, b) => b.increase - a.increase || b.seats2026 - a.seats2026 || a.school.localeCompare(b.school, "zh-Hans-CN"));

  return {
    batch: batch.label,
    sources: {
      y2025: batch.y2025.source,
      y2026: batch.y2026.source,
    },
    summary: {
      batch: batch.label,
      rows2025: rows25.length,
      rows2026: rows26.length,
      seats2025: rows25.reduce((sum, row) => sum + planCount(row.syjh), 0),
      seats2026: rows26.reduce((sum, row) => sum + planCount(row.syjh), 0),
      schools2025: schools25.size,
      schools2026: schools26.size,
      majorNames2025: majors25.size,
      majorNames2026: majors26.size,
      comparableOfferings: [...offerings26.keys()].filter((key) => offerings25.has(key)).length,
      newSchoolCount: newSchools.length,
      newMajorNameCount: newMajorNames.length,
      newOfferingCount: newOfferings.length,
      increasedOfferingCount: increasedOfferings.length,
      increasedSeatTotal: increasedOfferings.reduce((sum, row) => sum + row.increase, 0),
    },
    newSchools,
    newMajorNames,
    newOfferings,
    increasedOfferings,
  };
}

const compared = batches.map(compareBatch);
const summaryRows = compared.map((item) => ({
  ...item.summary,
  seatChange: item.summary.seats2026 - item.summary.seats2025,
}));

const totals = summaryRows.reduce(
  (total, row) => {
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "number") total[key] = (total[key] ?? 0) + value;
    }
    return total;
  },
  { batch: "合计" },
);

const reportData = {
  generatedAt: new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
  localDataDir: "plan-comparison/",
  sources: batches.flatMap((batch) => [
    { year: "2025", batch: batch.label, url: batch.y2025.source },
    { year: "2026", batch: batch.label, url: batch.y2026.source },
  ]),
  summaryRows: [...summaryRows, totals],
  newSchools: compared.flatMap((item) => item.newSchools),
  newMajorNames: compared.flatMap((item) => item.newMajorNames),
  newOfferings: compared.flatMap((item) => item.newOfferings),
  increasedOfferings: compared.flatMap((item) => item.increasedOfferings),
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function metricCard(label, value, subtext) {
  return `<article class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><em>${escapeHtml(subtext)}</em></article>`;
}

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>2026 vs 2025 内蒙古本科批与高职（专科）批招生计划变化报告</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #16202a;
      --muted: #64707d;
      --line: #d8dee7;
      --paper: #f7f8fb;
      --panel: #ffffff;
      --accent: #0f766e;
      --accent-2: #8b5cf6;
      --warn: #b45309;
      --soft: #e8f3f1;
      --soft-2: #f0edf9;
      --shadow: 0 16px 45px rgba(22, 32, 42, 0.08);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif;
      color: var(--ink);
      background: var(--paper);
      line-height: 1.55;
    }
    header {
      background: linear-gradient(135deg, #0f766e 0%, #2f4858 58%, #374151 100%);
      color: #fff;
      padding: 42px max(24px, calc((100vw - 1220px) / 2)) 34px;
    }
    header h1 {
      margin: 0 0 12px;
      font-size: clamp(26px, 4vw, 46px);
      line-height: 1.16;
      letter-spacing: 0;
      max-width: 980px;
    }
    header p {
      margin: 0;
      color: rgba(255, 255, 255, 0.84);
      max-width: 960px;
      font-size: 16px;
    }
    main {
      width: min(1220px, calc(100vw - 32px));
      margin: -22px auto 48px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }
    .metric {
      background: var(--panel);
      border: 1px solid rgba(216, 222, 231, 0.9);
      border-radius: 8px;
      padding: 17px 18px;
      box-shadow: var(--shadow);
      min-height: 128px;
    }
    .metric span, .metric em {
      display: block;
      color: var(--muted);
      font-style: normal;
      font-size: 13px;
    }
    .metric strong {
      display: block;
      margin: 8px 0;
      font-size: clamp(24px, 3.6vw, 38px);
      line-height: 1;
      letter-spacing: 0;
    }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
      margin-top: 18px;
      box-shadow: 0 10px 28px rgba(22, 32, 42, 0.05);
    }
    section h2 {
      margin: 0 0 10px;
      font-size: 22px;
      letter-spacing: 0;
    }
    .note {
      color: var(--muted);
      margin: 0 0 14px;
      max-width: 1040px;
    }
    .source-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 18px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
      color: var(--muted);
      font-size: 14px;
    }
    .source-list a { color: var(--accent); word-break: break-all; }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(220px, 420px) 180px 180px 180px auto;
      gap: 10px;
      align-items: center;
      margin: 14px 0 12px;
    }
    input, select, button {
      font: inherit;
      min-height: 38px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fff;
      color: var(--ink);
    }
    input, select { padding: 8px 10px; width: 100%; }
    button {
      padding: 8px 12px;
      cursor: pointer;
      background: var(--soft);
      border-color: #b9d9d4;
      color: #0b4f4a;
    }
    button:hover { background: #d9ece9; }
    .table-wrap {
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      max-height: 640px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      min-width: 860px;
    }
    th, td {
      border-bottom: 1px solid #edf0f4;
      padding: 9px 10px;
      text-align: left;
      vertical-align: top;
      font-size: 14px;
    }
    th {
      position: sticky;
      top: 0;
      z-index: 2;
      background: #f1f5f7;
      color: #344251;
      font-weight: 700;
      white-space: nowrap;
    }
    td.number, th.number { text-align: right; }
    tr:hover td { background: #fafcfd; }
    .pager {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      color: var(--muted);
      margin-top: 10px;
      font-size: 14px;
    }
    .pager-actions { display: flex; gap: 8px; }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      padding: 3px 9px;
      border-radius: 999px;
      background: var(--soft-2);
      color: #4c1d95;
      font-size: 12px;
      white-space: nowrap;
    }
    .summary-table { max-height: none; }
    .method {
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 18px;
    }
    .method ul {
      margin: 8px 0 0;
      padding-left: 20px;
      color: var(--muted);
    }
    .method li { margin: 5px 0; }
    @media (max-width: 920px) {
      .metrics, .source-list, .method { grid-template-columns: 1fr; }
      .toolbar { grid-template-columns: 1fr; }
      main { width: min(100vw - 20px, 1220px); }
      section { padding: 16px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>2026 相比 2025 招生计划变化报告</h1>
    <p>范围仅含内蒙古自治区普通高校招生计划中的本科批与高职（专科）批。报告生成时间：${escapeHtml(reportData.generatedAt)}；原始数据已下载到 ${escapeHtml(reportData.localDataDir)}。</p>
  </header>
  <main>
    <div class="metrics">
      ${metricCard("2026 新增院校", reportData.newSchools.length, "按同批次院校名称比较")}
      ${metricCard("2026 新增专业名称", reportData.newMajorNames.length, "按同批次专业名称比较")}
      ${metricCard("新增招生专业明细", reportData.newOfferings.length, "院校+科类+专业+计划类别口径")}
      ${metricCard("名额增加明细", reportData.increasedOfferings.length, `合计增加 ${totals.increasedSeatTotal ?? 0} 个计划`)}
    </div>

    <section class="method">
      <div>
        <h2>比较口径</h2>
        <p class="note">“新增院校”按同一批次的院校名称归一化后比较；“新增专业名称”按同一批次专业名称比较；“名额增加”按同一批次、院校名称、科类、专业名称、计划类别、计划性质聚合招生计划数后比较。</p>
        <ul>
          <li>聚合时忽略专业组号和专业代码，减少代码调整造成的误判。</li>
          <li>院校名称发生实质改名或括注变化时，仍可能被识别为新增院校。</li>
          <li>数据来自招生考试信息网公开 JSON，字段 <code>syjh</code> 为招生计划数。</li>
        </ul>
      </div>
      <div>
        <h2>数据来源</h2>
        <ul class="source-list">
          ${reportData.sources.map((source) => `<li>${escapeHtml(source.year)} ${escapeHtml(source.batch)}：<a href="${escapeHtml(source.url)}">${escapeHtml(source.url)}</a></li>`).join("")}
        </ul>
      </div>
    </section>

    <section>
      <h2>总览</h2>
      <p class="note">计划数为各专业明细 <code>syjh</code> 直接求和，合计行是本科批与高职（专科）批相加。</p>
      <div class="table-wrap summary-table">
        <table>
          <thead><tr><th>批次</th><th class="number">2025条目</th><th class="number">2026条目</th><th class="number">2025计划数</th><th class="number">2026计划数</th><th class="number">计划变化</th><th class="number">新增院校</th><th class="number">新增专业名称</th><th class="number">名额增加明细</th><th class="number">名额增加合计</th></tr></thead>
          <tbody>
            ${reportData.summaryRows.map((row) => `<tr><td>${escapeHtml(row.batch)}</td><td class="number">${row.rows2025 ?? ""}</td><td class="number">${row.rows2026 ?? ""}</td><td class="number">${row.seats2025 ?? ""}</td><td class="number">${row.seats2026 ?? ""}</td><td class="number">${row.seatChange ?? ""}</td><td class="number">${row.newSchoolCount ?? ""}</td><td class="number">${row.newMajorNameCount ?? ""}</td><td class="number">${row.increasedOfferingCount ?? ""}</td><td class="number">${row.increasedSeatTotal ?? ""}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section id="new-schools"></section>
    <section id="new-major-names"></section>
    <section id="new-offerings"></section>
    <section id="increased-offerings"></section>
  </main>

  <script id="report-data" type="application/json">${safeJson(reportData)}</script>
  <script>
    const report = JSON.parse(document.getElementById("report-data").textContent);

    const tableConfigs = {
      "new-schools": {
        title: "新增院校",
        note: "2026同批次出现、2025同批次未出现的院校。已联网核验的合并/更名/升格会在“判定”列标出；“2026新增招生”表示按招生计划口径新增，不等同于学校新设。",
        rows: report.newSchools,
        columns: [
          ["batch", "批次"],
          ["schoolCodes", "院校代号"],
          ["school", "院校名称"],
          ["status", "判定"],
          ["predecessor", "前身/说明"],
          ["basis", "判定依据"],
          ["source", "核验来源"],
          ["seats2026", "2026计划数", "number"],
          ["rows2026", "专业条目", "number"],
          ["representativeMajors", "代表专业"],
        ],
      },
      "new-major-names": {
        title: "新增专业名称",
        note: "2026同批次出现、2025同批次未出现的专业名称；这是一种专业名称层面的变化，不限定具体院校。",
        rows: report.newMajorNames,
        columns: [
          ["batch", "批次"],
          ["major", "专业名称"],
          ["seats2026", "2026计划数", "number"],
          ["rows2026", "条目", "number"],
          ["schoolCount", "涉及院校", "number"],
          ["categories", "涉及科类"],
          ["representativeSchools", "代表院校"],
        ],
      },
      "new-offerings": {
        title: "新增招生专业明细",
        note: "2026存在、2025不存在的同批次“院校+科类+专业名称+计划类别+计划性质”组合。",
        rows: report.newOfferings,
        columns: [
          ["batch", "批次"],
          ["category", "科类"],
          ["schoolCodes", "院校代号"],
          ["school", "院校名称"],
          ["major", "专业名称"],
          ["seats2026", "2026计划数", "number"],
          ["planType", "计划类别"],
          ["nature", "计划性质"],
          ["groupCodes2026", "2026专业组"],
          ["majorCodes2026", "2026专业代码"],
          ["duration", "学制"],
          ["fee", "学费"],
          ["requirement", "选科要求"],
          ["places", "办学地点"],
        ],
      },
      "increased-offerings": {
        title: "招生名额增加的专业",
        note: "仅统计2025和2026均存在的同口径组合，按增加名额从高到低排序。",
        rows: report.increasedOfferings,
        categoryGroupFilter: true,
        columns: [
          ["batch", "批次"],
          ["category", "科类"],
          ["schoolCodes2026", "2026院校代号"],
          ["school", "院校名称"],
          ["major", "专业名称"],
          ["seats2025", "2025计划数", "number"],
          ["seats2026", "2026计划数", "number"],
          ["increase", "增加", "number"],
          ["planType", "计划类别"],
          ["nature", "计划性质"],
          ["groupCodes2025", "2025专业组"],
          ["groupCodes2026", "2026专业组"],
        ],
      },
    };

    function escapeText(value) {
      return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[char]));
    }

    function renderInteractiveTable(id, config) {
      const host = document.getElementById(id);
      const state = { page: 1, pageSize: 100, query: "", batch: "all", categoryGroup: "all" };
      const batches = [...new Set(config.rows.map((row) => row.batch))];
      host.innerHTML = \`
        <h2>\${escapeText(config.title)} <span class="pill">\${config.rows.length} 条</span></h2>
        <p class="note">\${escapeText(config.note)}</p>
        <div class="toolbar">
          <input type="search" aria-label="搜索\${escapeText(config.title)}" placeholder="搜索院校、专业、科类、备注" data-role="search">
          <select aria-label="筛选批次" data-role="batch">
            <option value="all">全部批次</option>
            \${batches.map((batch) => \`<option value="\${escapeText(batch)}">\${escapeText(batch)}</option>\`).join("")}
          </select>
          \${config.categoryGroupFilter ? \`
          <select aria-label="筛选历史类或物理类" data-role="category-group">
            <option value="all">全部科类</option>
            <option value="history">历史类</option>
            <option value="physics">物理类</option>
          </select>\` : ""}
          <select aria-label="每页条数" data-role="page-size">
            <option value="50">每页 50 条</option>
            <option value="100" selected>每页 100 条</option>
            <option value="200">每页 200 条</option>
            <option value="500">每页 500 条</option>
          </select>
          <button type="button" data-role="download">下载当前结果 CSV</button>
        </div>
        <div class="table-wrap"><table><thead></thead><tbody></tbody></table></div>
        <div class="pager"><span data-role="page-info"></span><div class="pager-actions"><button type="button" data-role="prev">上一页</button><button type="button" data-role="next">下一页</button></div></div>
      \`;

      const searchInput = host.querySelector('[data-role="search"]');
      const batchSelect = host.querySelector('[data-role="batch"]');
      const categoryGroupSelect = host.querySelector('[data-role="category-group"]');
      const pageSizeSelect = host.querySelector('[data-role="page-size"]');
      const prevButton = host.querySelector('[data-role="prev"]');
      const nextButton = host.querySelector('[data-role="next"]');
      const downloadButton = host.querySelector('[data-role="download"]');
      const pageInfo = host.querySelector('[data-role="page-info"]');
      const thead = host.querySelector("thead");
      const tbody = host.querySelector("tbody");

      thead.innerHTML = "<tr>" + config.columns.map(([, label, type]) => \`<th class="\${type === "number" ? "number" : ""}">\${escapeText(label)}</th>\`).join("") + "</tr>";

      function filteredRows() {
        const query = state.query.trim().toLowerCase();
        return config.rows.filter((row) => {
          if (state.batch !== "all" && row.batch !== state.batch) return false;
          if (state.categoryGroup === "history" && !String(row.category ?? "").includes("历史")) return false;
          if (state.categoryGroup === "physics" && !String(row.category ?? "").includes("物理")) return false;
          if (!query) return true;
          return config.columns.some(([key]) => String(row[key] ?? "").toLowerCase().includes(query));
        });
      }

      function render() {
        const rows = filteredRows();
        const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
        state.page = Math.min(state.page, totalPages);
        const start = (state.page - 1) * state.pageSize;
        const visibleRows = rows.slice(start, start + state.pageSize);
        tbody.innerHTML = visibleRows.map((row) => "<tr>" + config.columns.map(([key, , type]) => {
          const value = row[key] ?? "";
          const content = key === "source" && String(value).startsWith("http")
            ? \`<a href="\${escapeText(value)}" target="_blank" rel="noopener">查看来源</a>\`
            : escapeText(value);
          return \`<td class="\${type === "number" ? "number" : ""}">\${content}</td>\`;
        }).join("") + "</tr>").join("");
        pageInfo.textContent = \`共 \${rows.length} 条，当前第 \${state.page} / \${totalPages} 页\`;
        prevButton.disabled = state.page <= 1;
        nextButton.disabled = state.page >= totalPages;
      }

      function downloadCsv() {
        const rows = filteredRows();
        const header = config.columns.map(([, label]) => label);
        const lines = [header, ...rows.map((row) => config.columns.map(([key]) => row[key] ?? ""))];
        const csv = lines.map((line) => line.map((value) => \`"\${String(value).replace(/"/g, '""')}"\`).join(",")).join("\\n");
        const blob = new Blob(["\\ufeff", csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = \`\${id}.csv\`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      searchInput.addEventListener("input", () => {
        state.query = searchInput.value;
        state.page = 1;
        render();
      });
      batchSelect.addEventListener("change", () => {
        state.batch = batchSelect.value;
        state.page = 1;
        render();
      });
      if (categoryGroupSelect) {
        categoryGroupSelect.addEventListener("change", () => {
          state.categoryGroup = categoryGroupSelect.value;
          state.page = 1;
          render();
        });
      }
      pageSizeSelect.addEventListener("change", () => {
        state.pageSize = Number(pageSizeSelect.value);
        state.page = 1;
        render();
      });
      prevButton.addEventListener("click", () => {
        state.page -= 1;
        render();
      });
      nextButton.addEventListener("click", () => {
        state.page += 1;
        render();
      });
      downloadButton.addEventListener("click", downloadCsv);
      render();
    }

    for (const [id, config] of Object.entries(tableConfigs)) {
      renderInteractiveTable(id, config);
    }
  </script>
</body>
</html>`;

fs.writeFileSync(outputPath, html, "utf8");

console.log(`Report written to ${outputPath}`);
console.log(`New schools: ${reportData.newSchools.length}`);
console.log(`New major names: ${reportData.newMajorNames.length}`);
console.log(`New offering details: ${reportData.newOfferings.length}`);
console.log(`Increased offering details: ${reportData.increasedOfferings.length}`);
