import type { Metadata } from "next";
import PlannerApp from "./PlannerApp";

export const metadata: Metadata = {
  title: "帕鲁育种实验室 1.0",
  description: "选择毕业帕鲁与四词条，从现有库存规划完整孵化路线和逐步操作清单。",
};

export default function Home() {
  return <PlannerApp />;
}
