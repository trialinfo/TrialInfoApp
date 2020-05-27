var randomBytes = require('nativescript-randombytes');
var base64url = require('base64url');

/* Return a random 16-character string */
export function random_tag(): string {
    return base64url(randomBytes(12));
}

export function rider_name(rider): string {
    let words = [];
    if (rider.last_name != null)
	words.push(rider.last_name);
    if (rider.first_name != null)
	words.push(rider.first_name);
    return words.join(' ');
}

export function merge_sorted(a, b, compare) {
    let alen = a.length, blen = b.length;
    let result = new Array(alen + blen);
    let i = 0, j = 0, k = 0;

    if (!compare)
	compare = (a, b) => a < b;

    while (i < alen && j < blen)
	result[k++] = compare(a[i], b[j]) ? a[i++] : b[j++];
    while(i < alen)
	result[k++] = a[i++];
    while(j < blen)
	result[k++] = b[j++];

    return result;
}

export function range(start: number, count: number) {
    if(arguments.length == 1) {
	count = start;
	start = 0;
    }

    let array = [];
    for (let i = 0; i < count; i++) {
	array.push(start + i);
    }
    return array;
}
