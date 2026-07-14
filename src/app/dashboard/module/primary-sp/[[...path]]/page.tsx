import { SpModuleFrame } from "@/components/dashboard/SpModuleFrame";
import { findSubmoduleBySegments, resolveSpUrl } from "@/data/modules";

type Props = {
  params: Promise<{ path?: string[] }>;
};

export default async function PrimarySpModulePage({ params }: Props) {
  const { path } = await params;
  const sub = findSubmoduleBySegments(path);
  const src = resolveSpUrl(sub.spPath);

  return <SpModuleFrame src={src} />;
}
