const MAX_IMAGE_WIDTH = 900;
const IMAGE_QUALITY = 0.68;

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function preparePastedImage(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const scale = Math.min(1, MAX_IMAGE_WIDTH / image.width);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
}

function formatAttachmentTitle() {
  const date = new Date();

  return `截图 ${date.toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  })}`;
}

export function createImageAttachment(src) {
  const attachment = document.createElement("figure");
  attachment.className = "image-attachment";
  attachment.contentEditable = "false";

  const button = document.createElement("button");
  button.className = "image-toggle";
  button.type = "button";
  button.textContent = formatAttachmentTitle();

  const image = document.createElement("img");
  image.className = "image-preview";
  image.src = src;
  image.alt = "粘贴的截图";
  image.hidden = true;

  attachment.append(button, image);
  return attachment;
}
