import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import helvetikerFontUrl from '@/assets/fonts/helvetiker_regular.typeface.json?url';

export async function loadFont(){
    const loader = new FontLoader();
    const font = await loader.loadAsync( helvetikerFontUrl );
    return font;
}