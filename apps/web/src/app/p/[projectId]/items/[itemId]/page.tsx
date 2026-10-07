import { ItemDetail } from "@/components/items/item-detail";

const ItemPage = async ({
  params,
}: {
  params: Promise<{ projectId: string; itemId: string }>;
}) => {
  const { projectId, itemId } = await params;
  // A new key per item resets local state (e.g. an open description editor).
  return <ItemDetail key={itemId} projectId={projectId} itemId={itemId} />;
};

export default ItemPage;
