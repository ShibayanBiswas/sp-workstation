import { SpModuleFrame } from "@/components/dashboard/SpModuleFrame";
import {
  findSubmoduleBySegments,
  getModuleByRouteSlug,
  resolveEmbedUrl,
} from "@/data/modules";

type Props = {
  params: Promise<{ path?: string[] }>;
};

export default async function OptionsLabModulePage({ params }: Props) {
  const { path } = await params;
  const group = getModuleByRouteSlug("options-lab")!;
  const sub = findSubmoduleBySegments("options-lab", path);
  const src = resolveEmbedUrl(group, sub.spPath);

  return (
    <SpModuleFrame
      src={src}
      title={group.frameTitle}
      frameTitle={group.label}
    />
  );
}
