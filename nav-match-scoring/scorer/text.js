// text.js — 文本预处理：清洗文本，去除标点符号和空白

/**
 * 清洗文本：只去除标点符号和空白，**不再过滤停用词**
 * 停用词改为单独计算权重（见 calculateStopWordScore）
 * @param {string} text - 原始文本
 * @returns {string} 清洗后的文本
 */
export function cleanText(text) {
    if (!text) return '';

    // 1. 去除标点符号和特殊字符
    let cleaned = text.replace(
        /[，。！？、；：""''「」【】《》（）\-\+\=\[\]\{\}\|\\\/\~\`\@\#\$\%\^\&\*\(\)\n\r\t]/g,
        ' '
    );

    // 2. 去除多余空白
    cleaned = cleaned.replace(/\s+/g, ' ');

    // 3. 合并为连续字符串（停用词不再移除，留待单独计分）
    return cleaned.split(' ').join('');
}
