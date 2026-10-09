import { test, expect } from '@playwright/test';

test('moon sunlight survives distance, render scale and rebasing while preserving night and eclipse', async ({page}) => {
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.route('**/__moon-lighting-test',route=>route.fulfill({contentType:'text/html',body:
    '<!doctype html><script type="module" src="/demos/solar-system/e2e/fixtures/moon-sunlight.ts"></script>'}));
  await page.goto('./__moon-lighting-test');
  const output=page.locator('#lighting-results');await expect(output).toBeVisible();
  const values=JSON.parse(await output.innerText()) as Record<string,number>;
  expect(errors).toEqual([]);
  expect(values.day).toBeGreaterThan(100);
  expect(values.night).toBeLessThan(5);
  expect(values.eclipse).toBeLessThan(5);
  for(const variant of ['farSun','rebased','tiny'])expect(Math.abs(values[variant]!-values.day!)).toBeLessThan(3);
});
