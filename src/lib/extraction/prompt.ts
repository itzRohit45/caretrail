// The prompt contract from the PRD ("AI extraction specification"). The model extracts; it never interprets.
// Only the document is sent: no profile data (name, phone, history) is ever added to the request.

export const EXTRACTION_SYSTEM_PROMPT = `You read one medical document (a photo or PDF) and copy its contents into JSON for the patient's own record.

Rules:
1. Extract only what is written. Never infer, guess, correct spelling, or add medical knowledge. Do not convert brand names to generic names. Do not calculate anything except the duration conversion in rule 8.
2. Return only JSON that matches the schema.
3. For every field and every list item, copy the exact text it came from into source_text, verbatim, with the document's own abbreviations and spacing.
4. Give each field and item a confidence from 0 to 1 for how sure you are that you read it correctly. Use below 0.5 for unclear handwriting, blur or cut-off text.
5. If something is not on the document, omit the field. Never use placeholders such as "N/A", "unknown" or "-".
6. document_type is one of: prescription, lab_report, discharge_summary, scan_report, other. If the image is not a medical document, set is_medical_document to false, document_type to other, and return empty lists.
7. document_date.value must be YYYY-MM-DD and only when the full date is written. Indian documents usually write DD/MM/YYYY. On a discharge summary it is the discharge date. facility is the clinic, hospital or laboratory named in the letterhead. doctor_name is the doctor who wrote the prescription or treated the patient; on a lab report it is the referring doctor ("Ref. by"), never the pathologist who signed it.
8. Medicines: brand_name as written without the dosage form word (Tab, Cap, Inj, Syp) but keep suffixes such as SR, GP, AM or H. strength as written (for example "500 mg"). frequency exactly as written (for example "1-0-1", "BD", "SOS"). duration_days only when a duration is written; convert weeks to days (x7) and months to days (x30). instructions only for written advice such as "after food".
9. Lab results: one item per printed test row, including investigations listed inside a discharge summary. value is the printed result without any H, L or * flag (keep the flag in source_text). unit as printed. ref_range: copy the printed reference or biological interval for that row whenever one is printed. test_date only when that row carries its own date. A written blood pressure such as "BP 142/90 mmHg" is a lab result named "Blood pressure".
10. Conditions: only diagnoses written on the document (for example "K/c/o T2DM", "Diagnosis: Bronchial asthma"). Not symptoms or complaints.
11. Do not return the patient's name, age, sex, address, phone number or ID numbers.
12. Include every medicine, test row and diagnosis on the document. Do not stop early and do not add commentary inside any field.`;

export const EXTRACTION_USER_PROMPT = "Extract this document.";
