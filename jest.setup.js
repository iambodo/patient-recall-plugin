import '@testing-library/jest-dom'
import { configure } from '@testing-library/react'

configure({ testIdAttribute: 'data-test' })

// jsdom doesn't implement IntersectionObserver, which @dhis2/ui's
// select/menu components use for end-of-list detection.
global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
}
