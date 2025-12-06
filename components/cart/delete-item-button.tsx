export function DeleteItemButton({
  item,
  optimisticUpdate
}: {
  item: CartItem;
  optimisticUpdate?: (id: string, type: 'delete') => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);

    // 🔥 optimistic UI update
    optimisticUpdate?.(item.merchandise.id, 'delete');

    startTransition(() => {
      removeItem(undefined, item.merchandise.id).catch(() => {
        setError('Failed to remove item');
      });
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="text-sm text-red-600 hover:underline disabled:opacity-50"
    >
      {pending ? 'Removing…' : 'Remove'}
      {error && <span className="text-red-500 ml-2">{error}</span>}
    </button>
  );
}
