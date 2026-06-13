export const AUTHORS = {
  yingjun: {
    id: "yingjun",
    label: "英俊",
    color: "blue",
  },
  hongxia: {
    id: "hongxia",
    label: "红霞",
    color: "red",
  },
};

const LEGACY_AUTHOR_IDS = {
  me: "yingjun",
  wife: "hongxia",
};

const AUTHOR_COLORS = {
  blue: "#2563eb",
  red: "#ef4444",
  wife: "#ef4444",
  me: "#2563eb",
  hongxia: "#ef4444",
  yingjun: "#2563eb",
  w: "#ef4444",
  m: "#2563eb",
  laopo: "#ef4444",
  husband: "#2563eb",
  "老婆": "#ef4444",
  "我": "#2563eb",
  "红霞": "#ef4444",
  "英俊": "#2563eb",
  "红": "#ef4444",
  "红色": "#ef4444",
  "蓝": "#2563eb",
  "蓝色": "#2563eb",
};

export function getAuthor(authorId) {
  const normalizedAuthorId = LEGACY_AUTHOR_IDS[authorId] || authorId;

  return AUTHORS[normalizedAuthorId] || AUTHORS.yingjun;
}

export function getAuthorColor(value) {
  if (!value) {
    return null;
  }

  const color = value.trim().toLowerCase();

  if (AUTHOR_COLORS[color]) {
    return AUTHOR_COLORS[color];
  }

  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) {
    return color;
  }

  return null;
}

export function getRecordAuthorColor(record) {
  return getAuthorColor(record.authorColor || record.authorId);
}
