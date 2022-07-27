# Abacus.AI JavaScript Streamining Library

Use the latest library by adding:

`<script async src="https://static.abacus.ai/sdk/js/streaming.v4.min.js"></script>`

To your webpage. Then initialize the library with your streaming token and datasetIds by calling:

```
reaitag('init', {streamingToken: '***',
        datasets: {
            interaction: '***',
            item: '***',
            user: '***'
        },
    });
```

You can checkout the example on [JSFiddle](https://jsfiddle.net/gh/get/library/pure/abacusai/streaming-javascript/tree/main/example)
