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

export default async function OptionChainArchiveModulePage({ params }: Props) {
  const { path } = await params;
  const group = getModuleByRouteSlug("option-chain-archive");
  if (!group) notFound();
  const sub = findSubmoduleBySegments("option-chain-archive", path);
  const src = resolveEmbedUrl(group, sub.spPath);

  return (
    <SpModuleFrame
      src={src}
      title={group.frameTitle}
      frameTitle={group.label}
    />
  );
}
