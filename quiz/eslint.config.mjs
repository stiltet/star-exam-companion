import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const config = [...nextCoreWebVitals, { ignores: ['.next*/**', 'out*/**', 'test-results/**', 'node_modules/**'] }]

export default config
