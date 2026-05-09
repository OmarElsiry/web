export function tafqeet(number: number): string {
    const fraction = Math.round((number % 1) * 100);
    const num = Math.floor(number);

    if (num === 0) return fraction > 0 ? `فقط ${fraction} قرشاً لا غير` : 'صفر';

    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const onesFeminine = ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    function convertGroup(n: number): string {
        let text = '';
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const o = n % 10;

        if (h > 0) {
            text += hundreds[h];
        }

        if (t === 1 && o > 0) {
            if (text !== '') text += ' و ';
            if (o === 1) text += 'أحد عشر';
            else if (o === 2) text += 'اثنا عشر';
            else text += ones[o] + ' عشر';
        } else {
            if (o > 0) {
                if (text !== '') text += ' و ';
                text += ones[o];
            }
            if (t > 0) {
                if (text !== '') text += ' و ';
                text += tens[t];
            }
        }
        return text;
    }

    let result = '';

    const millions = Math.floor(num / 1000000);
    const thousands = Math.floor((num % 1000000) / 1000);
    const rest = num % 1000;

    if (millions > 0) {
        if (millions === 1) result += 'مليون';
        else if (millions === 2) result += 'مليونان';
        else if (millions >= 3 && millions <= 10) result += convertGroup(millions) + ' ملايين';
        else result += convertGroup(millions) + ' مليون';
    }

    if (thousands > 0) {
        if (result !== '') result += ' و ';
        if (thousands === 1) result += 'ألف';
        else if (thousands === 2) result += 'ألفان';
        else if (thousands >= 3 && thousands <= 10) result += convertGroup(thousands) + ' آلاف';
        else result += convertGroup(thousands) + ' ألف';
    }

    if (rest > 0) {
        if (result !== '') result += ' و ';
        result += convertGroup(rest);
    }

    let finalStr = `فقط ${result} جنيهاً مصرياً`;
    if (fraction > 0) {
        finalStr += ` و ${fraction} قرشاً`;
    }
    finalStr += ' لا غير';

    return finalStr;
}
