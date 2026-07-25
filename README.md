# MMM-ImagesPhotos

This is a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror). It displays photos from a directory.

This module reads the images from the _uploads_ directory inside the module.

**Directory:** `~/MagicMirror/modules/MMM-ImagesPhotos/uploads`

## Features

- Displays photos from a local directory
- Sequential or non-repeating shuffled playback
- Fullscreen and windowed display modes
- Optional touchscreen navigation
- Notification-based slideshow controls

## Installation

1. Clone this repository inside your MagicMirror's `modules` folder

```bash
cd ~/MagicMirror/modules
git clone https://github.com/sdetweil/MMM-ImagesPhotos
cd MMM-ImagesPhotos
npm install
```

## How it looks

![Demo](.github/animate.gif)

## Interactive Slideshow

MMM-ImagesPhotos includes an optional interactive slideshow mode for touchscreen displays.

When `touch` is enabled, the following gestures are available:

| Gesture | Action |
|----------|--------|
| Swipe left | Show next photo |
| Swipe right | Show previous photo |
| Tap | Pause or resume slideshow |

Touch support is disabled by default and must be enabled in the module configuration.

When `sequential` is `false`, images are displayed using a shuffled playlist. Every image is shown once before the playlist is reshuffled, preventing immediate repeats.

## Config

The entry in `config.js` can include the following options:

<!-- prettier-ignore-start -->
| Option             | Description |
|--------------------|-------------|
| `opacity`          | The opacity of the image.<br><br>**Type:** `double`<br>Default `0.9` |
| `animationSpeed`   | How long the fade out and fade in of photos should take.<br><br>**Type:** `int`<br>Default `500` |
| `updateInterval`   | How long before loading a new image.<br><br>**Type:** `int` (milliseconds)<br>Default `5000` |
| `getInterval`      | How often to refresh the image list from the directory.<br><br>**Type:** `int` (milliseconds)<br>Default `60000` |
| `sequential`       | Display images sequentially (`true`) or using a non-repeating shuffled playlist (`false`).<br><br>Default `false` |
| `touch`            | Enable touchscreen gesture support.<br><br>**Type:** `boolean`<br>Default `false` |
| `swipeDistance`    | Minimum horizontal movement (pixels) required to detect a swipe.<br><br>**Type:** `int`<br>Default `50` |
| `tapDistance`      | Maximum finger movement (pixels) still considered a tap.<br><br>**Type:** `int`<br>Default `10` |
| only when position is `NOT` `fullscreen_below` or `fullscreen_above` ||
| `maxWidth`         | Maximum image width. Possible values are absolute (for example `"700px"`) or relative (for example `"50%"`).<br><br>Default `"100%"` |
| `maxHeight`        | Maximum image height. Possible values are absolute (for example `"400px"`) or relative (for example `"70%"`).<br><br>Default `"100%"` |
| only when position `IS` `fullscreen_below` or `fullscreen_above` ||
| `backgroundColor`  | Background color shown around the image when `fill` is `false`. Accepts standard CSS colors (for example `#808080`).<br><br>Default `"black"` |
| `fill`             | Fill unused screen space with a blurred copy of the current image.<br><br>Default `false` |
| `blur`             | Blur radius used when `fill` is enabled.<br><br>Default `8` |

## Example Configuration

### Standard display

```js
{
  module: "MMM-ImagesPhotos",
  position: "middle_center",
  config: {
    opacity: 0.9,
    animationSpeed: 500,
    updateInterval: 5000,
    maxHeight: "500px",
    maxWidth: "500px",

    sequential: false,

    touch: true,
    swipeDistance: 50,
    tapDistance: 10
  }
},
```

### Fullscreen display

```js
{
  module: "MMM-ImagesPhotos",
  position: "fullscreen_below",
  config: {
    opacity: 0.9,
    animationSpeed: 500,
    updateInterval: 5000,

    backgroundColor: "grey",
    fill: false,
    blur: 10,

    sequential: false,

    touch: true
  }
},
```
