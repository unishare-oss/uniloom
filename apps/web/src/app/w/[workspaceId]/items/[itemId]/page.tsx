import { ItemDetail } from "@/components/items/item-detail";

const ItemPage = async ({
  params,
}: {
  params: Promise<{ workspaceId: string; itemId: string }>;
}) => {
  const { workspaceId, itemId } = await params;
  // A new key per item resets local state (e.g. an open description editor).
  return <ItemDetail key={itemId} workspaceId={workspaceId} itemId={itemId} />;
};

export default ItemPage;
