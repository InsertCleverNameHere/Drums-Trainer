# Third-Party Licenses

This project includes third-party libraries that are bundled for offline-first PWA functionality. All libraries comply with their respective open-source licenses.

---

## GSAP (GreenSock Animation Platform)

**Version**: 3.x  
**License**: GreenSock Standard License  
**Source**: https://greensock.com/gsap/  
**Usage**: High-performance animations for visual feedback (beat indicators, panning)

### License Terms

GSAP is free to use in non-commercial projects. For commercial use, a license is required from GreenSock.

**Standard License Summary**:
- Free for non-commercial, personal, or educational projects
- Commercial projects require a paid license
- See full terms: https://greensock.com/standard-license/

**Why it's bundled**: Included locally to ensure offline PWA functionality and consistent performance.

---

## noUiSlider

**Version**: 15.x  
**License**: MIT License  
**Source**: https://refreshless.com/nouislider/  
**Usage**: BPM range sliders (dual-handle and single-handle)

### MIT License

Copyright (c) 2022 Léon Gersen

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

**Why it's bundled**: Included locally to ensure offline PWA functionality and fast load times.

---

## Additional Notes

### Why Bundle Instead of CDN?

This project is designed as a **fully offline-capable PWA**. Bundling libraries ensures:

1. **Offline functionality** - No network requests required after initial install
2. **Performance** - No external dependencies or CDN latency
3. **Privacy** - No third-party tracking or data collection
4. **Reliability** - No risk of CDN downtime or version changes

### License Compliance

- All bundled libraries are used in accordance with their licenses
- GSAP usage falls under the Standard License (free for non-commercial use)
- noUiSlider is MIT-licensed (permissive, allows bundling)
- Source attribution is maintained in this file and in code comments

### Updating Dependencies

When updating bundled libraries:

1. Check for license changes
2. Update version numbers in this file
3. Verify offline functionality still works
4. Update service worker cache (`service-worker.js`)

---

**Last Updated**: 2025-01-01  
**Project License**: ISC (see LICENSE file in project root)
