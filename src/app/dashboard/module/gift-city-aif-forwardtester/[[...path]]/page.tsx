import { SpModuleFrame } from "@/components/dashboard/SpModuleFrame";
import {
  findSubmoduleBySegments,
  getModuleByRouteSlug,
  resolveEmbedUrl,
} from "@/data/modules";

type Props = {
  params: Promise<{ path?: string[] }>;
};

export default async function GiftCityAifForwardtesterModulePage({
  params,
}: Props) {
  const { path } = await params;
  const group = getModuleByRouteSlug("gift-city-aif-forwardtester")!;
  const sub = findSubmoduleBySegments("gift-city-aif-forwardtester", path);
  const src = resolveEmbedUrl(group, sub.spPath);

  return (
    <SpModuleFrame
      src={src}
      title={group.frameTitle}
      frameTitle={group.label}
    />
  );
}
