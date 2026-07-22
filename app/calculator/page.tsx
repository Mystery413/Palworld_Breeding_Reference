import type { Metadata } from "next";
import BreedingCalculatorPage from "../BreedingCalculatorPage";

export const metadata: Metadata = {
  title: "帕鲁配种计算器",
  description: "用任意亲代或子代条件即时查询 Palworld 1.0 配种公式。",
};

export default function Page() {
  return <BreedingCalculatorPage />;
}
