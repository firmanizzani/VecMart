// Illustrative data shared by the public report and AI previews.
export const landingSalesHours = [
  { hour: '08', revenue: 20000, profit: 4000, transactions: 1 },
  { hour: '10', revenue: 38000, profit: 8000, transactions: 1 },
  { hour: '12', revenue: 32000, profit: 6500, transactions: 1 },
  { hour: '14', revenue: 45000, profit: 9000, transactions: 1 },
  { hour: '16', revenue: 29000, profit: 6000, transactions: 1 },
  { hour: '18', revenue: 22000, profit: 4500, transactions: 1 }
];
const revenue = landingSalesHours.reduce((total, item) => total + item.revenue, 0);
const transactions = landingSalesHours.reduce((total, item) => total + item.transactions, 0);
export const landingSales = {
  revenue,
  profit: landingSalesHours.reduce((total, item) => total + item.profit, 0),
  transactions,
  average: transactions ? Math.round(revenue / transactions) : 0
};
