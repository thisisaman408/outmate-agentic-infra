export interface Employee {
  name: string;
  title: string;
  email: string;
  emailConfidence: string;
  linkedin: string;
  twitter: string;
  instagram: string;
  github: string;
  otherSocials: string;
  department: string;
  seniority: string;
  location: string;
  phone: string;
  company: string;
  source: string;
  recentActivity: string;
}

export interface TeamFinderData {
  employees: Employee[];
  csvRaw: string;
  companyName: string;
  summary: {
    total: number;
    withEmail: number;
    withPhone: number;
    withLinkedIn: number;
    bySeniority: Record<string, number>;
  };
}

function extractCsvBlock(text: string): string {
  const csvMatch = text.match(/```csv\s*\n([\s\S]*?)```/);
  return csvMatch ? csvMatch[1].trim() : "";
}

function parseCsvRows(csv: string): Employee[] {
  if (!csv) return [];

  const lines = csv.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const dataLines = lines.slice(1);
  const employees: Employee[] = [];

  for (const line of dataLines) {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());

    const clean = fields.map((f) =>
      f.replace(/^"|"$/g, "").replace(/""/g, '"'),
    );

    if (clean.length >= 1 && clean[0]) {
      employees.push({
        name: clean[0] ?? "",
        title: clean[1] ?? "",
        email: clean[2] ?? "",
        emailConfidence: clean[3] ?? "",
        linkedin: clean[4] ?? "",
        twitter: clean[5] ?? "",
        instagram: clean[6] ?? "",
        github: clean[7] ?? "",
        otherSocials: clean[8] ?? "",
        department: clean[9] ?? "",
        seniority: clean[10] ?? "",
        location: clean[11] ?? "",
        phone: clean[12] ?? "",
        company: clean[13] ?? "",
        source: clean[14] ?? "",
        recentActivity: clean[15] ?? "",
      });
    }
  }

  return employees;
}

export function parseTeamFinderOutput(text: string): TeamFinderData {
  const csvRaw = extractCsvBlock(text);
  const employees = parseCsvRows(csvRaw);

  const companyMatch = text.match(/\*\*Company:\*\*\s*(.+?)(?:\s*\*|\n)/);
  const companyName =
    companyMatch?.[1] ??
    (employees.length > 0 ? employees[0].company : "Unknown Company");

  const bySeniority: Record<string, number> = {};
  for (const emp of employees) {
    const s = emp.seniority || "Unknown";
    bySeniority[s] = (bySeniority[s] ?? 0) + 1;
  }

  return {
    employees,
    csvRaw,
    companyName,
    summary: {
      total: employees.length,
      withEmail: employees.filter(
        (e) => e.email && e.email !== '""' && e.email !== "",
      ).length,
      withPhone: employees.filter(
        (e) => e.phone && e.phone !== '""' && e.phone !== "",
      ).length,
      withLinkedIn: employees.filter(
        (e) => e.linkedin && e.linkedin !== '""' && e.linkedin !== "",
      ).length,
      bySeniority,
    },
  };
}
