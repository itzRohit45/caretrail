// Simulated documents for the three demo patients. Fictional clinics, doctors and values in Chennai.
// Nothing here is real patient data.

const ravi = { name: "Ravi Kumar", age: 55, sex: "M" };
const lakshmi = { name: "Lakshmi Iyer", age: 42, sex: "F" };
const arun = { name: "Arun Prakash", age: 68, sex: "M" };

const suresh = { doctor: "Dr. A. Suresh", quals: "MD (Gen. Med.), Diabetologist", reg: "TNMC 48213", clinic: "Suresh Diabetes & Wellness Clinic", address: "14, Kutchery Road, Mylapore, Chennai 600004", phone: "044 2499 1180" };
const ramesh = { doctor: "Dr. K. Ramesh", quals: "MBBS, General Physician", reg: "TNMC 71540", clinic: "Ramesh Family Clinic", address: "3/12, 100 Feet Road, Velachery, Chennai 600042", phone: "044 2243 5571" };
const lakshmanan = { doctor: "Dr. S. Lakshmanan", quals: "MS (ENT)", reg: "TNMC 55902", clinic: "Lakshmanan ENT Centre", address: "88, Poonamallee High Road, Kilpauk, Chennai 600010", phone: "044 2641 7720" };
const priyaRaman = { doctor: "Dr. Priya Raman", quals: "MD, DM (Cardiology)", reg: "TNMC 66314", clinic: "Heartline Cardiac Clinic", address: "21, Sardar Patel Road, Adyar, Chennai 600020", phone: "044 2441 9033" };
const revathi = { doctor: "Dr. Revathi Natarajan", quals: "MD, DM (Endocrinology)", reg: "TNMC 52877", clinic: "Natarajan Thyroid & Hormone Clinic", address: "9, TTK Road, Alwarpet, Chennai 600018", phone: "044 2435 6602" };
const karthik = { doctor: "Dr. Karthik Balaji", quals: "MD (Pulmonary Medicine)", reg: "TNMC 60148", clinic: "Breathe Easy Chest Clinic", address: "42, Khader Nawaz Khan Road, Nungambakkam, Chennai 600006", phone: "044 2833 1490" };
const vikram = { doctor: "Dr. Vikram Srinivasan", quals: "MD, DM (Cardiology)", reg: "TNMC 45690", clinic: "Sri Venkateswara Heart Institute", address: "7, GST Road, Guindy, Chennai 600032", phone: "044 2234 8800" };
const farook = { doctor: "Dr. M. Farook", quals: "MBBS", reg: "TNMC 73366", clinic: "Farook Clinic", address: "56, Anna Salai, Saidapet, Chennai 600015", phone: "044 2435 1207" };

const sriRam = { lab: "Sri Ram Diagnostics", address: "112, Royapettah High Road, Mylapore, Chennai 600004", phone: "044 2498 7700", pathologist: "Dr. Kavitha Rao, MD (Pathology)" };
const lister = { lab: "Lister Labs", address: "5, Usman Road, T. Nagar, Chennai 600017", phone: "044 2815 3300", pathologist: "Dr. R. Shankar, MD (Biochemistry)" };
const medall = { lab: "Medall Diagnostics Centre", address: "2nd Avenue, Anna Nagar, Chennai 600040", phone: "044 2626 1144", pathologist: "Dr. Nirmala Devi, MD (Pathology)" };
const hitech = { lab: "Hitech Diagnostics", address: "31, Dr. Radhakrishnan Salai, Mylapore, Chennai 600004", phone: "044 2847 2211", pathologist: "Dr. P. Anand, MD (Biochemistry)" };
const anand = { lab: "Anand Labs", address: "19, Mount Road, Guindy, Chennai 600032", phone: "044 2250 6633", pathologist: "Dr. S. Meera, MD (Pathology)" };
const kaveri = { hospital: "Kaveri Multispeciality Hospital", address: "81, Lattice Bridge Road, Adyar, Chennai 600020", phone: "044 4040 2222" };
const svhi = { hospital: "Sri Venkateswara Heart Institute", address: "7, GST Road, Guindy, Chennai 600032", phone: "044 2234 8800" };

export const documents = [
  // ---------------- Ravi Kumar ----------------
  { patient: "ravi", file: "01-lab-hba1c-nov-2025", kind: "lab", as: "pdf", ...sriRam, who: ravi, refBy: "Dr. A. Suresh", date: "08/11/2025", labNo: "SRD-25-118420",
    sections: [{ title: "Biochemistry", rows: [
      ["Glycosylated Haemoglobin (HbA1c)", "6.8", "%", "4.0 - 5.6"],
      ["Fasting Blood Sugar (FBS)", "128", "mg/dL", "70 - 99"],
      ["Post Prandial Blood Sugar (PPBS)", "176", "mg/dL", "70 - 139"],
    ] }] },
  { patient: "ravi", file: "02-rx-suresh-nov-2025", kind: "rx", as: "pdf", ...suresh, who: ravi, date: "12/11/2025", vitals: "BP: 146/92 mmHg   Wt: 79 kg",
    dx: "K/c/o T2DM. Systemic hypertension.",
    meds: [["Tab. Glycomet 500 mg", "1-0-1", "x 90 days", "After food"], ["Tab. Amlong 5 mg", "1-0-0", "x 90 days", "After food"]],
    advice: "Diet and walking 30 min daily. Review after 3 months with HbA1c." },
  { patient: "ravi", file: "03-discharge-kaveri-mar-2026", kind: "discharge", as: "pdf", ...kaveri, who: ravi, ipNo: "KMH/IP/26/03114",
    admitted: "08/03/2026", discharged: "12/03/2026", consultant: "Dr. Shalini Menon, MD (Internal Medicine)",
    dx: ["Hypoglycaemia secondary to poor oral intake", "Acute gastroenteritis", "Type 2 diabetes mellitus", "Systemic hypertension"],
    course: "Admitted with giddiness and loose stools for 2 days. CBG on arrival 52 mg/dL, corrected with IV dextrose. Gastroenteritis managed with IV fluids. Amlodipine changed to telmisartan in view of pedal oedema. Stable at discharge.",
    investigations: [["HbA1c", "7.1 %", "09/03/2026"], ["Serum creatinine", "1.0 mg/dL", "09/03/2026"], ["Serum sodium", "134 mmol/L", "09/03/2026"]],
    meds: [["Tab. Glycomet 500 mg", "1-0-1", "Continue"], ["Tab. Telma 40 mg", "1-0-0", "Continue"], ["Tab. Pantocid 40 mg", "1-0-0 before food", "14 days"]],
    followUp: "Review with your diabetologist in 2 weeks. Avoid skipping meals." },
  { patient: "ravi", file: "04-lab-lipid-mar-2026", kind: "lab", as: "pdf", ...lister, who: ravi, refBy: "Dr. A. Suresh", date: "20/03/2026", labNo: "LL-0326-55871",
    sections: [{ title: "Lipid Profile", rows: [
      ["Total Cholesterol", "214", "mg/dL", "< 200"],
      ["Triglycerides", "186", "mg/dL", "< 150"],
      ["HDL Cholesterol", "39", "mg/dL", "> 40"],
      ["LDL Cholesterol (Calculated)", "138", "mg/dL", "< 100"],
      ["VLDL Cholesterol", "37", "mg/dL", "< 30"],
    ] }] },
  { patient: "ravi", file: "05-lab-kidney-jun-2026", kind: "lab", as: "pdf", ...sriRam, who: ravi, refBy: "Dr. A. Suresh", date: "14/06/2026", labNo: "SRD-26-061377",
    sections: [{ title: "Renal Function Test", rows: [
      ["Blood Urea", "32", "mg/dL", "15 - 40"],
      ["Serum Creatinine", "1.1", "mg/dL", "0.7 - 1.3"],
      ["eGFR (CKD-EPI)", "74", "mL/min/1.73m²", "> 90"],
      ["Serum Uric Acid", "6.2", "mg/dL", "3.5 - 7.2"],
    ] }] },
  { patient: "ravi", file: "06-rx-suresh-aug-2026", kind: "rx", as: "pdf", ...suresh, who: ravi, date: "20/08/2026", vitals: "BP: 138/88 mmHg   Wt: 78 kg",
    dx: "T2DM. HTN. Dyslipidaemia.",
    meds: [["Tab. Glycomet 500 mg", "1-0-1", "x 90 days", "After food"], ["Tab. Telma 40 mg", "1-0-0", "x 90 days", ""], ["Tab. Atorva 10 mg", "0-0-1", "x 90 days", "After food"]],
    advice: "Repeat HbA1c and lipid profile after 3 months." },
  { patient: "ravi", file: "07-rx-ramesh-sep-2026-photo", kind: "rx", as: "photo", hand: true, ...ramesh, who: ravi, date: "02/09/2026", vitals: "BP 140/90",
    dx: "c/o tiredness, thirst. Known DM.",
    meds: [["Tab Gluconorm 500", "1-0-1", "x 30 days", "after food"], ["Tab Ecosprin 75", "0-1-0", "x 30 days", "after lunch"]],
    advice: "Check sugar. Review 1 month." },
  { patient: "ravi", file: "08-lab-hba1c-sep-2026", kind: "lab", as: "pdf", ...sriRam, who: ravi, refBy: "Dr. K. Ramesh", date: "19/09/2026", labNo: "SRD-26-091902",
    sections: [{ title: "Biochemistry", rows: [
      ["Glycosylated Haemoglobin (HbA1c)", "7.4", "%", "4.0 - 5.6"],
      ["Fasting Blood Sugar (FBS)", "146", "mg/dL", "70 - 99"],
    ] }] },
  { patient: "ravi", file: "09-lab-fbs-medall-sep-2026", kind: "lab", as: "pdf", ...medall, who: ravi, refBy: "Self", date: "19/09/2026", labNo: "MDC-919-20488",
    sections: [{ title: "Clinical Biochemistry", rows: [["Glucose - Fasting", "139", "mg/dL", "70 - 100"]] }] },
  { patient: "ravi", file: "10-rx-lakshmanan-sep-2026", kind: "rx", as: "pdf", ...lakshmanan, who: ravi, date: "25/09/2026", vitals: "Temp: 99.4 F",
    dx: "Acute pharyngitis.",
    meds: [["Cap. Mox 500 mg", "1-1-1", "x 5 days", "After food"], ["Tab. Dolo 650 mg", "SOS", "x 3 days", "For fever"]],
    advice: "Warm saline gargles. Plenty of fluids." },
  { patient: "fresh", file: "ravi-live-upload-rx-oct-2026", kind: "rx", as: "photo", ...priyaRaman, who: ravi, date: "08/10/2026", vitals: "BP: 148/94 mmHg   HR: 82/min",
    dx: "HTN, not at goal. T2DM. Dyslipidaemia.",
    meds: [["Tab. Telma AM 40/5", "1-0-0", "x 30 days", "After food"], ["Tab. Rosuvas 10 mg", "0-0-1", "x 30 days", "After food"]],
    advice: "Low salt diet. Home BP log. Review in 4 weeks." },

  // ---------------- Lakshmi Iyer ----------------
  { patient: "lakshmi", file: "01-lab-thyroid-dec-2025", kind: "lab", as: "pdf", ...hitech, who: lakshmi, refBy: "Dr. Revathi Natarajan", date: "03/12/2025", labNo: "HTD-1225-3341",
    sections: [{ title: "Thyroid Function", rows: [
      ["TSH (Ultrasensitive)", "6.8", "µIU/mL", "0.35 - 5.50"],
      ["Free T4 (FT4)", "0.9", "ng/dL", "0.8 - 1.8"],
    ] }] },
  { patient: "lakshmi", file: "02-rx-revathi-dec-2025", kind: "rx", as: "pdf", ...revathi, who: lakshmi, date: "06/12/2025", vitals: "Wt: 64 kg   Pulse: 68/min",
    dx: "Primary hypothyroidism.",
    meds: [["Tab. Thyronorm 50 mcg", "1-0-0", "x 90 days", "Empty stomach, 30 min before breakfast"]],
    advice: "Repeat TSH after 3 months." },
  { patient: "lakshmi", file: "03-lab-tsh-mar-2026", kind: "lab", as: "pdf", ...hitech, who: lakshmi, refBy: "Dr. Revathi Natarajan", date: "15/03/2026", labNo: "HTD-0326-1187",
    sections: [{ title: "Thyroid Function", rows: [["TSH (Ultrasensitive)", "4.6", "µIU/mL", "0.35 - 5.50"]] }] },
  { patient: "lakshmi", file: "04-rx-karthik-apr-2026-photo", kind: "rx", as: "photo", ...karthik, who: lakshmi, date: "10/04/2026", vitals: "SpO2: 97%   PEFR: 290 L/min",
    dx: "Bronchial asthma, mild persistent.",
    meds: [["Foracort 200 Inhaler", "2 puffs BD", "x 30 days", "Rinse mouth after use"], ["Asthalin 100 mcg Inhaler", "2 puffs SOS", "", "For breathlessness"], ["Tab. Montair 10 mg", "0-0-1", "x 30 days", ""]],
    advice: "Avoid dust and smoke. Review in 1 month." },
  { patient: "lakshmi", file: "05-lab-tsh-cbc-aug-2026", kind: "lab", as: "pdf", ...hitech, who: lakshmi, refBy: "Dr. Revathi Natarajan", date: "22/08/2026", labNo: "HTD-0826-2950",
    sections: [{ title: "Thyroid Function", rows: [["TSH (Ultrasensitive)", "2.6", "µIU/mL", "0.35 - 5.50"]] }, { title: "Haematology", rows: [["Haemoglobin", "12.1", "g/dL", "12.0 - 15.0"]] }] },
  { patient: "lakshmi", file: "06-rx-revathi-aug-2026", kind: "rx", as: "pdf", ...revathi, who: lakshmi, date: "25/08/2026", vitals: "Wt: 62 kg",
    dx: "Primary hypothyroidism, on treatment.",
    meds: [["Tab. Thyronorm 75 mcg", "1-0-0", "x 90 days", "Empty stomach"]],
    advice: "Repeat TSH after 3 months." },

  // ---------------- Arun Prakash ----------------
  { patient: "arun", file: "01-lab-troponin-apr-2026", kind: "lab", as: "pdf", lab: "Sri Venkateswara Heart Institute Laboratory", address: svhi.address, phone: svhi.phone, pathologist: "Dr. J. Mary, MD (Biochemistry)", who: arun, refBy: "Emergency Department", date: "28/04/2026", labNo: "SVHI-L-26-04471",
    sections: [{ title: "Cardiac Markers", rows: [["Troponin I (hs)", "2.8", "ng/mL", "< 0.04"]] }, { title: "Lipid Profile", rows: [["Total Cholesterol", "238", "mg/dL", "< 200"], ["LDL Cholesterol (Direct)", "156", "mg/dL", "< 100"], ["HDL Cholesterol", "36", "mg/dL", "> 40"], ["Triglycerides", "172", "mg/dL", "< 150"]] }] },
  { patient: "arun", file: "02-echo-may-2026", kind: "scan", as: "pdf", ...svhi, who: arun, date: "01/05/2026", title: "2D Echocardiography Report", doctor: "Dr. Vikram Srinivasan, DM (Cardiology)",
    findings: ["Regional wall motion abnormality in LAD territory.", "LV ejection fraction 45%.", "Mild mitral regurgitation.", "No pericardial effusion."],
    impression: "Ischaemic heart disease with mild LV systolic dysfunction (LVEF 45%)." },
  { patient: "arun", file: "03-discharge-svhi-may-2026", kind: "discharge", as: "pdf", ...svhi, who: arun, ipNo: "SVHI/IP/26/01962",
    admitted: "28/04/2026", discharged: "02/05/2026", consultant: "Dr. Vikram Srinivasan, MD, DM (Cardiology)",
    dx: ["Acute NSTEMI", "Coronary artery disease, single vessel (LAD)", "PCI with drug eluting stent to LAD on 29/04/2026", "Systemic hypertension", "Dyslipidaemia"],
    course: "Presented with chest pain of 3 hours. Troponin I elevated. Coronary angiogram showed 90% LAD stenosis; PCI with one drug eluting stent done. Post procedure uneventful.",
    investigations: [["Troponin I", "2.8 ng/mL", "28/04/2026"], ["LDL cholesterol", "156 mg/dL", "28/04/2026"], ["LVEF (Echo)", "45 %", "01/05/2026"]],
    meds: [["Tab. Ecosprin 75 mg", "0-1-0", "Lifelong"], ["Tab. Clopilet 75 mg", "0-1-0", "12 months"], ["Tab. Atorva 40 mg", "0-0-1", "Continue"], ["Tab. Metolar 25 mg", "1-0-1", "Continue"], ["Tab. Ramistar 2.5 mg", "1-0-0", "Continue"], ["Tab. Pantocid 40 mg", "1-0-0 before food", "Continue"], ["Tab. Sorbitrate 5 mg", "SOS for chest pain", "Under the tongue"]],
    followUp: "Cardiology review after 4 weeks. Do not stop Ecosprin or Clopilet without consulting the cardiologist." },
  { patient: "arun", file: "04-rx-vikram-jun-2026", kind: "rx", as: "pdf", ...vikram, who: arun, date: "10/06/2026", vitals: "BP: 128/80 mmHg   HR: 64/min",
    dx: "CAD s/p PCI to LAD. HTN. Dyslipidaemia.",
    meds: [["Tab. Ecosprin 75 mg", "0-1-0", "x 90 days", "After lunch"], ["Tab. Clopilet 75 mg", "0-1-0", "x 90 days", "After lunch"], ["Tab. Atorva 40 mg", "0-0-1", "x 90 days", ""], ["Tab. Metolar 25 mg", "1-0-1", "x 90 days", ""], ["Tab. Ramistar 2.5 mg", "1-0-0", "x 90 days", ""]],
    advice: "Cardiac rehab walking programme. Lipid profile after 6 weeks." },
  { patient: "arun", file: "05-lab-lipid-jul-2026", kind: "lab", as: "pdf", ...anand, who: arun, refBy: "Dr. Vikram Srinivasan", date: "15/07/2026", labNo: "AL-0715-7731",
    sections: [{ title: "Lipid Profile", rows: [["Total Cholesterol", "148", "mg/dL", "< 200"], ["LDL Cholesterol (Direct)", "82", "mg/dL", "< 70"], ["HDL Cholesterol", "41", "mg/dL", "> 40"], ["Triglycerides", "128", "mg/dL", "< 150"]] }] },
  { patient: "arun", file: "06-lab-kidney-jul-2026", kind: "lab", as: "pdf", ...anand, who: arun, refBy: "Dr. Vikram Srinivasan", date: "15/07/2026", labNo: "AL-0715-7732",
    sections: [{ title: "Renal Function Test", rows: [["Serum Creatinine", "1.2", "mg/dL", "0.7 - 1.3"], ["Serum Potassium", "4.6", "mmol/L", "3.5 - 5.1"]] }] },
  { patient: "arun", file: "07-rx-farook-aug-2026-photo", kind: "rx", as: "photo", ...farook, who: arun, date: "05/08/2026", vitals: "BP 130/84",
    dx: "Acidity, epigastric burning.",
    meds: [["Cap. Omez 20 mg", "1-0-0", "x 14 days", "Before breakfast"], ["Tab. Dolo 650 mg", "SOS", "", "For pain"]],
    advice: "Avoid spicy food. Small frequent meals." },
  { patient: "arun", file: "08-rx-vikram-sep-2026", kind: "rx", as: "pdf", ...vikram, who: arun, date: "12/09/2026", vitals: "BP: 126/78 mmHg   Mild ankle swelling",
    dx: "CAD s/p PCI. HTN. Pedal oedema.",
    meds: [["Tab. Dytor 10 mg", "1-0-0", "x 30 days", "Morning"]],
    advice: "Continue all other cardiac medicines. Review in 1 month." },
];
