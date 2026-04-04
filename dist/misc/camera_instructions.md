# Camera Controls Guide

This guide explains how end-users can navigate the 3D map using touch gestures on their mobile devices.

## Touch Gestures

### 1. Panning & Moving Around
- **Action:** Single Finger Drag
- **How to do it:** Place one finger on the screen and drag it in any direction.
- **What it does:** Moves the camera laterally across the current floor map without changing the viewing angle.

### 2. Zooming In and Out
- **Action:** Two Finger Pinch or Spread
- **How to do it:** Place two fingers on the screen. Move them closer together (pinch) to zoom out, or move them further apart (spread) to zoom in.
- **What it does:** Moves the camera closer to or further away from the map.

### 3. Rotating the Camera
- **Action:** Two Finger Parallel Swipe
- **How to do it:** Place two fingers on the screen and drag them together in a parallel motion (typically in a horizontal or circular motion).
- **What it does:** Rotates the camera around the point you are currently looking at, allowing you to see the map from different angles.

### 4. Selecting and Interacting
- **Action:** Single Finger Tap
- **How to do it:** Briefly tap once on a location, room, or icon.
- **What it does:** Selects the interactive object, displays its information, and smoothly animates the camera to focus on it.

---

## How to Create Clear Finger-Movement GIFs

To create high-quality GIFs that clearly illustrate these touch gestures to your users (e.g., for an onboarding screen or tutorial overlay), follow these steps:

### Option 1: Screen Recording with "Show Touches" Enabled (Authentic & Easy)
This is the easiest way to get authentic-looking gestures directly from a physical device.

**For Android:**
1. Enable **Developer Options** (Go to Settings > About Phone > Tap "Build Number" 7 times).
2. In Developer Options, find and turn on **"Show taps"** or **"Show touches"**. This will display a white circle wherever a finger touches the screen.
3. Use the built-in Screen Recorder (or a third-party app like AZ Screen Recorder) to record your screen while you perform the gestures cleanly on the Funtasia app.
4. Transfer the MP4 video to your computer and convert it to a GIF using an online tool like [Ezgif.com](https://ezgif.com/video-to-gif) or Adobe Premiere.

**For iOS (iPhone/iPad):**
iOS does not natively support an always-on "Show Touches" feature during screen recording, but you can use AssistiveTouch to simulate it:
1. Go to **Settings > Accessibility > Touch > AssistiveTouch** and turn it on.
2. In AssistiveTouch, create a **Custom Gesture** spanning a pinch or rotate motion.
3. Start the built-in iOS Screen Recorder.
4. Activate your custom gesture on the screen in the 3D app so the little tracking bubbles show up.
5. Convert the resulting video to a GIF.

### Option 2: Overlaying Animated Hand Assets (Professional & Studio Quality)
If you want ultra-clean, studio-quality tutorial GIFs (like the ones used by major apps like Google Maps or Apple Maps):

1. **Record the movement:** Take a clean screen recording on your phone (or a web browser set to mobile view) of the map rotating, panning, or zooming *without* any touch indicators visible.
2. **Find Vector Assets:** Download transparent UI touch gesture animations. You can find high-quality, free animated hand/finger vectors on sites like [LottieFiles](https://lottiefiles.com/) (search "swipe gesture" or "pinch gesture") or [Flaticon](https://www.flaticon.com/).
3. **Composite the Video:** Use a video editor with layering capabilities (Adobe After Effects, Premiere Pro, Final Cut, or even Canva). Place the clean map recording on the bottom layer.
4. **Sync the Hands:** Overlay the transparent hand animation on top of your screen recording. Adjust the timing so the virtual fingers sync perfectly with the map movement.
5. **Export:** Export the final composition as an MP4 and convert it to a looping GIF.

### Recommended Settings for Web Tutorial GIFs:
- **Keep it short:** 2 to 4 seconds maximum per gesture so it loads instantly.
- **Loop infinitely:** Ensure the GIF seamlessly repeats the gesture.
- **Include Text:** Overlay a short, bold text label on the GIF (e.g., "Pinch to Zoom").
- **Optimize file size:** Keep the resolution low (e.g., 600x800px) and reduce the frame rate (15-20 FPS) to keep the file size under 1-2 MB so it doesn't slow down the Funtasia app's loading time.
