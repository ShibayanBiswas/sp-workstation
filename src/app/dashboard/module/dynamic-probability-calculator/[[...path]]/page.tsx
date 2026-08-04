import { notFound } from "next/navigation";
import { SpModuleFrame } from "@/components/dashboard/SpModuleFrame";
import {
  findSubmoduleBySegments,
  getModuleByRouteSlug,
  resolveEmbedUrl,
} from "@/data/modules";

type Props = {
  params: Promise<{ path?: string[] }>;
};

export default async function DynamicProbabilityCalculatorModulePage({
  params,
}: Props) {
  const { path } = await params;
  const group = getModuleByRouteSlug("dynamic-probability-calculator");
  if (!group) notFound();
  const sub = findSubmoduleBySegments("dynamic-probability-calculator", path);
  const src = resolveEmbedUrl(group, sub.spPath);

  return (
    <SpModuleFrame
      src={src}
      title={group.frameTitle}
      frameTitle={group.label}
    />
  );
}
