import { ImageResponse } from 'next/og';
import { getCollection } from 'lib/shopify';

export const size = {
  width: 1200,
  height: 630
};

export const contentType = 'image/png';

export default async function Image({
  params
}: {
  params: { collection: string };
}) {
  const collection = await getCollection(params.collection);
  const title = collection?.seo?.title || collection?.title || 'Collection';

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 56,
          color: 'white',
          background: '#000',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px'
        }}
      >
        {title}
      </div>
    ),
    {
      width: size.width,
      height: size.height
    }
  );
}
