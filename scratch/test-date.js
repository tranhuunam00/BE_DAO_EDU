const pricing = [
  {
    "id": "8a4ee078-928a-483c-8b46-ef339a3811e8",
    "courseLevelId": "d31c0eec-e2ae-4c3a-9b40-6027948ba666",
    "pricePerSession": "150000.00",
    "teacherWagePerSession": "1000000.00",
    "effectiveFrom": "2026-07-01",
    "effectiveTo": null,
    "createdAt": "2026-07-01T02:43:38.161Z",
    "updatedAt": "2026-07-01T02:43:38.161Z"
  }
];

const current = pricing.find((p) => !p.effectiveTo || new Date(p.effectiveTo) >= new Date());
console.log('Result:', current);
