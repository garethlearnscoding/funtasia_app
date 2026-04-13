With reference to @contextScopeItemMention can you implment handling and finding the correct camera that has flash capability. Instead of check the fone model, just cycle through all camera tracks until a flash is available

# Flash toggle [ Handling different devices]
Certain devices do not expose camera tracks to their web apps, for those that can, implement code to handle finding the camera that has flash capabilities.

# Process
1. QR scanner is triggered
2. cycle through all available camera tracks
3. pick out the one that has flash capability. 
    a. If there are more than one that have flash capability, choose the default normal lens
4. If no camera has flash capabilities, swap the flash button with a string of text informing the user that "Flash is unavailable"

# Take Note
1. I have tested this on an iphone. The toggle first allows the flash to turn on, however, it breaks when the ios version is older than 17.2 but does not work reliably until 18.4