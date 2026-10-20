module.exports = {
  content: ['./public/*.html', './public/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        olive: { DEFAULT: '#3A4D2A', dark: '#2D3D1F', light: '#4A5D3A', soft: '#E8EDE0', muted: '#F0F3EC' },
        cream: { DEFAULT: '#FAF9F6', dark: '#F5F1EB', line: '#E8E0D0' },
        gold: { DEFAULT: '#C9B48A', dark: '#A68F5E', deep: '#6B5A2E', light: '#F5ECD6' },
        ink: { DEFAULT: '#1E1E1E', muted: '#5C5C5C', light: '#8A8A8A' },
        footer: '#1F2A18'
      },
      fontFamily: { thmanyah: ['Thmanyah Sans', 'sans-serif'], display: ['Thmanyah Serif Display', 'serif'], inter: ['Inter', 'sans-serif'] },
      boxShadow: {
        soft: '0 2px 20px rgba(58,77,42,0.06)',
        card: '0 8px 30px rgba(58,77,42,0.08)',
        lift: '0 20px 40px rgba(58,77,42,0.12)'
      }
    }
  }
};
