export const SITES = [
	{
		url: 'https://www.theguardian.com/uk',
		requestBody: {
			addStyleTag: `
        #notice {
          display: none;
        }
      `,
		},
	},
	{
		url: 'https://www.itv.com/news',
		requestBody: {
			addStyleTag: `
        #cassie-widget {
          display: none;
        }
      `,
		},
	},
	{
		url: 'https://bbc.co.uk/news/',
		requestBody: {
			addStyleTag: `
        .ssrcss-darju4-ConsentBanner {
          display: none;
        }
      `,
		},
	},
	{
		url: 'https://news.sky.com/',
		requestBody: {
			addStyleTag: `
        #notice {
          display: none;
        }
      `,
		},
	},
];
