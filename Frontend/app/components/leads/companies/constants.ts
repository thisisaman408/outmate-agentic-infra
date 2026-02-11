export const ALL_FILTERS = {
  industry: {
    type: "select",
    label: "Industry",
    options: [
      "Software Development",
      "Information Technology",
      "Financial Services",
      "Healthcare",
      "Manufacturing",
      "Retail",
      "Consulting",
      "Education",
      "Technology",
      "SaaS",
      "Fintech",
      "Health Tech",
      "E-commerce",
      "Biotechnology",
      "Artificial Intelligence"
    ]
  },
  company_size: {
    type: "range",
    label: "Company Size",
    min: 1,
    max: 10000,
    step: 100,
    unit: "employees"
  },
  revenue: {
    type: "select",
    label: "Revenue Range",
    options: [
      "< $1M",
      "$1M - $10M",
      "$10M - $50M",
      "$50M - $100M",
      "$100M - $500M",
      "$500M - $1B",
      "> $1B"
    ]
  },
  funding_stage: {
    type: "checkbox",
    label: "Funding Stage",
    options: [
      "Seed",
      "Series A",
      "Series B",
      "Series C",
      "Series D+",
      "Private Equity",
      "Public",
      "Bootstrapped",
      "Acquired"
    ]
  },
  location: {
    type: "text",
    label: "Location"
  },
  founded_year: {
    type: "range",
    label: "Founded Year",
    min: 1900,
    max: 2024,
    step: 1,
    unit: ""
  },
  company_type: {
    type: "select",
    label: "Company Type",
    options: [
      "Public Company",
      "Private Company",
      "Non-Profit",
      "Government",
      "Educational Institution",
      "Startup",
      "SME",
      "Enterprise"
    ]
  },
  employee_growth: {
    type: "select",
    label: "Employee Growth",
    options: [
      "Declining",
      "Stable",
      "Growing Slowly",
      "Growing Fast",
      "Hyper Growth"
    ]
  }
}
