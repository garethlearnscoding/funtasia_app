# Transition sequence between child model and parent model when directory marker is set to a child model
1. Render a directory marker on the specific object the directory entry points to
2. take note of the parent object
3. when the user clicks exit area, load the parent floor model and focus in on the parent object with the directory marker on that object
4. make sure to render and unrender` the directory marker when needed

# Floor switching behaviour when directory marker is set to a child model on a different floor
1. proceed as per usual
2. when the user clicks exit area, it should render the parent floor of the child object with the directory marker at the parent object

# Styling
- Place the Close directory marker at the bottom of the screen at a lower z index, then bottom sheet, do not hide and unhide it