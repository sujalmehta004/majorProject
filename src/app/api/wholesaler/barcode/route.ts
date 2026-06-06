import { NextResponse } from 'next/server';
import bwipjs from 'bwip-js';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get('productId');
    const batchNumber = url.searchParams.get('batchNumber');

    if (!productId || !batchNumber) {
      return NextResponse.json({ error: 'Missing productId or batchNumber' }, { status: 400 });
    }

    const text = `${productId.substring(0, 8).toUpperCase()}-${batchNumber.toUpperCase()}`;

    const png = await bwipjs.toBuffer({
      bcid: 'code128',       // Barcode type
      text: text,            // Text to encode
      scale: 3,              // 3x scaling factor
      height: 10,            // Bar height, in millimeters
      includetext: true,     // Show human-readable text under the barcode
      textxalign: 'center',
    });

    return new Response(new Uint8Array(png), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error: any) {
    console.error('Barcode generation error:', error);
    return NextResponse.json({ error: 'Failed to generate barcode image' }, { status: 500 });
  }
}
