const it_text = document.getElementsByClassName("recursive-text");
const it_list = ["an Experimental Psychologist.", "a Cognitive Neuroscientist.", "an applied methodologist."];
let counter = 0, step = 1000, current_text, char_pos = 0, adding = true;


const typewriter = () => {
    setTimeout(() => {
        current_text = it_list[counter];
        if (adding) {
            if (char_pos > current_text.length) {
                adding = false;
                setTimeout(() => {
                    typewriter();
                    counter = (counter < 2)? counter+1: 0;
                    current_text = it_list[counter];
                }, 2000)
            } else {
                char_pos++;
            }
        } else {
            if (char_pos == 0) {
                adding = true;
            } else {
                char_pos--;
            }
        }
        typewriter();
    }, step)
}

typewriter();
