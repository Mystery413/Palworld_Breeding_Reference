import type { Metadata } from "next";
import PaldexPage from "../PaldexPage";

export const metadata: Metadata = {
  title: "完整帕鲁图鉴",
  description: "搜索 Palworld 1.0 帕鲁图鉴、属性、野生等级与栖息地图。",
};

export default function Page() {
  return <PaldexPage />;
}
