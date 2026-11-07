async function test() {
  const res = await fetch("http://10.84.23.121:3000/menu");
  console.log("Status:", res.status);
  const text = await res.text();
  const fs = require("fs");
  fs.writeFileSync("scratch/menu.html", text);
  console.log("Saved menu.html, size:", text.length);
  // Find error message
  const match = text.match(/\"message\":\"([^\"]+)\"/);
  if (match) console.log("Extracted error:", match[1]);
  else {
    const titleMatch = text.match(/<title>([^<]+)<\/title>/);
    console.log("Title:", titleMatch ? titleMatch[1] : "none");
  }
}
test();

