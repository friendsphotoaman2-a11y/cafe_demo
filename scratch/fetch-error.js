async function check() {
  const res = await fetch("http://10.84.23.121:3000/t/04");
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body length:", text.length);
  // Write body to file to inspect
  const fs = require("fs");
  fs.writeFileSync("scratch/error-response.html", text);
  console.log("Saved to scratch/error-response.html");
}
check();

