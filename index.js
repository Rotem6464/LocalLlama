import fetch from 'node-fetch';
    import { GoogleSpreadsheet } from 'google-spreadsheet';
    import natural from 'natural';
    import { createRequire } from 'module';
    const require = createRequire(import.meta.url);
    const credentials = require('./credentials.json');

    const subreddit = 'LocalLLaMA';
    const timeFilter = 'month';
    const limit = 10;

    async function fetchRedditPosts() {
      const url = `https://www.reddit.com/r/${subreddit}/top.json?t=${timeFilter}&limit=${limit}`;
      const response = await fetch(url);
      const data = await response.json();
      return data.data.children.map(post => ({
        title: post.data.title,
        url: `https://www.reddit.com${post.data.permalink}`,
        postDate: new Date(post.data.created_utc * 1000).toISOString(),
        authorUrl: `https://www.reddit.com/user/${post.data.author}`,
        content: post.data.selftext
      }));
    }

    function analyzeTopic(text) {
      const tokenizer = new natural.WordTokenizer();
      const tokens = tokenizer.tokenize(text);
      const stemmed = tokens.map(token => natural.PorterStemmer.stem(token));
      
      const commonTopics = {
        'model': 'AI Models',
        'train': 'Training',
        'fine-tun': 'Fine-tuning',
        'hardwar': 'Hardware',
        'gpu': 'Hardware',
        'llm': 'AI Models',
        'prompt': 'Prompt Engineering',
        'quantiz': 'Quantization',
        'deploy': 'Deployment',
        'api': 'APIs'
      };

      const topicCounts = {};
      stemmed.forEach(word => {
        if (commonTopics[word]) {
          topicCounts[commonTopics[word]] = (topicCounts[commonTopics[word]] || 0) + 1;
        }
      });

      const mainTopic = Object.entries(topicCounts).sort((a, b) => b[1] - a[1])[0];
      return mainTopic ? mainTopic[0] : 'General Discussion';
    }

    function analyzeSentiment(text) {
      const analyzer = new natural.SentimentAnalyzer('English', natural.PorterStemmer, 'afinn');
      const score = analyzer.getSentiment(text.split(' '));
      
      if (score > 0.2) return 'Positive';
      if (score < -0.2) return 'Negative';
      return 'Neutral';
    }

    async function writeToGoogleSheet(posts) {
      const doc = new GoogleSpreadsheet('15M3-X30YmAP7xMvvFWvfS-wdekzaqpLu5bS10pye3cU');
      await doc.useServiceAccountAuth(credentials);
      await doc.loadInfo();
      
      const sheet = doc.sheetsByIndex[0] || await doc.addSheet();
      await sheet.clear();
      
      await sheet.setHeaderRow([
        'Title', 'URL', 'Post Date', 'Topic Analysis', 'Sentiment', 'Reddiator URL'
      ]);
      
      const rows = posts.map(post => [
        post.title,
        post.url,
        post.postDate,
        analyzeTopic(post.content),
        analyzeSentiment(post.content),
        post.authorUrl
      ]);
      
      await sheet.addRows(rows);
    }

    (async () => {
      try {
        const posts = await fetchRedditPosts();
        await writeToGoogleSheet(posts);
        console.log('Data successfully written to Google Sheet');
      } catch (error) {
        console.error('Error:', error);
      }
    })();
