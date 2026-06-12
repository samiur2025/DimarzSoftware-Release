import { jsPDF } from "jspdf";
try {
  const doc = new jsPDF();
  doc.text("Hello world!", 10, 10);
  const out = doc.output("arraybuffer");
  console.log("Output is ArrayBuffer:", out instanceof ArrayBuffer, "length:", out.byteLength);
} catch (e) {
  console.error("Error:", e);
}
