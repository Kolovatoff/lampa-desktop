function generatePin() {
  const pin = Math.floor(Math.random() * 10000);
  return pin.toString().padStart(4, "0");
}

function encryptJson(jsonData, pinStr) {
  const jsonString = JSON.stringify(jsonData);
  let encrypted = "";

  for (let i = 0; i < jsonString.length; i++) {
    const charCode = jsonString.charCodeAt(i);
    const key = parseInt(pinStr[i % 4], 10);
    encrypted += String.fromCharCode(charCode ^ key);
  }

  return btoa(unescape(encodeURIComponent(encrypted)));
}

function decryptJson(encryptedB64, pinStr) {
  const encryptedStep1 = atob(encryptedB64);
  const encryptedStep2 = escape(encryptedStep1);
  const encrypted = decodeURIComponent(encryptedStep2);

  let decrypted = "";
  for (let i = 0; i < encrypted.length; i++) {
    const charCode = encrypted.charCodeAt(i);
    const key = parseInt(pinStr[i % 4], 10);
    decrypted += String.fromCharCode(charCode ^ key);
  }

  return JSON.parse(decrypted);
}

module.exports = {
  generatePin,
  encryptJson,
  decryptJson,
};
