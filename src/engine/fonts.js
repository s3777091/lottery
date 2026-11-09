// Canvas does not trigger webfont loading like DOM text does. Load every
// weight and language subset before measuring or caching text as an image.
export async function loadCanvasFonts() {
  const sample = 'Quay Số May Mắn Huỳnh Đắc Tấn Đạt Nguyễn 0123456789';
  await Promise.all([
    '700 32px "Dancing Script"',
    '700 32px "Playfair Display"',
    '900 32px "Playfair Display"',
    '400 32px "Be Vietnam Pro"',
    '600 32px "Be Vietnam Pro"',
    '800 32px "Be Vietnam Pro"',
  ].map((font) => document.fonts.load(font, sample)));
  await document.fonts.ready;
}
