export function installTestApi(page, user, responses = {}) {
  return page.route('**/api/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/users/login') {
      return route.fulfill({ json: { access_token: 'test-api-token', user } });
    }
    const value = responses[request.method() + ' ' + path];
    if (typeof value === 'function') return value(route);
    return route.fulfill({ json: value ?? [] });
  });
}
