// Thème Tailwind du site (chargé juste après le CDN Tailwind, dans le <head> de chaque page)
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#fff1f2',
                    100: '#ffe4e6',
                    500: '#f43f5e',
                    600: '#e11d48',
                    700: '#be123c',
                    dark: '#0d0f12',
                    card: '#161922',
                    border: '#272d3d'
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif']
            }
        }
    }
};
