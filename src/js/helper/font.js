import { FontLoader } from 'three/addons/loaders/FontLoader.js';



export async function loadFont(){
    const loader = new FontLoader();
    const font = await loader.loadAsync( 'assets/fonts/helvetiker_regular.typeface.json' );
    return font;
}