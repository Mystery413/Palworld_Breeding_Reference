import type { Metadata } from "next";
import PlannerApp from "./PlannerApp";

export const metadata: Metadata = {
  title: "帕鲁育种实验室 1.0",
  description: "录入已有帕鲁与词条，规划最短育种路线和逐步操作清单。",
};

export default function Home() {
  return <PlannerApp />;
}
