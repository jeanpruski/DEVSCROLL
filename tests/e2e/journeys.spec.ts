import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
test('accès privé, connexion, fil, favori, recherche, détail et déconnexion', async ({ page }) => {
  await page.goto('/admin/posts');
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Adresse email').fill(process.env.OWNER_EMAIL!);
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.OWNER_PASSWORD!);
  await page.getByRole('button', { name: 'Entrer dans mon espace' }).click();
  await expect(page).toHaveURL(/\/feed/);
  await expect(page.getByRole('heading', { name: 'Une idée à la fois.' })).toBeVisible();
  const card = page.locator('.post-card').first();
  await expect(card).toBeVisible();
  const visual = card.locator('.post-visual img');
  await expect(visual).toHaveAttribute('src', /^\/post-art\//);
  await expect(visual).toHaveAttribute('alt', /Logo|Sticker/);
  await expect
    .poll(() => visual.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0))
    .toBe(true);
  const artResponse = await page.request.get((await visual.getAttribute('src')) || '');
  expect(artResponse.status()).toBe(200);
  expect(artResponse.headers()['cache-control']).toContain('immutable');
  const title = await card.locator('h2').innerText();
  const save = card.getByRole('button', { name: 'Enregistrer dans les favoris' });
  if (await save.count()) await save.click();
  await expect(card.getByRole('button', { name: 'Retirer des favoris' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Retirer des favoris' })).toBeEnabled();
  await page.reload();
  await expect(
    page.locator('.post-card').first().getByRole('button', { name: 'Retirer des favoris' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Favoris', exact: true }).first().click();
  await page.getByRole('textbox', { name: 'Rechercher dans mes favoris' }).fill(title);
  await expect(page.locator('.post-card h2')).toContainText(title);
  await page.locator('.post-card h2 a').first().click();
  await expect(page).toHaveURL(/\/posts\//);
  await page.getByText('Sources & contexte').click();
  await expect(page.locator('.sources a').first()).toBeVisible();
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/feed');
  await expect(page).toHaveURL(/\/login/);
});
test('administration, publication versionnée et retrait', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(process.env.OWNER_EMAIL!);
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.OWNER_PASSWORD!);
  await page.getByRole('button', { name: 'Entrer dans mon espace' }).click();
  await expect(page).toHaveURL(/\/feed/);
  await page.goto('/admin/posts/new');
  const slug = `verification-${randomUUID()}`;
  await page.getByLabel('Titre', { exact: true }).first().fill('Une vérification éditoriale temporaire');
  await page.getByLabel('Adresse (slug)').fill(slug);
  await page.getByLabel('Notion stable').fill(slug);
  await page.getByRole('button', { name: 'Ajouter une source' }).click();
  await page
    .getByLabel('URL officielle')
    .fill('https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all');
  await page.getByLabel('Titre', { exact: true }).last().fill('Promise.all');
  await page.getByLabel('Éditeur').fill('MDN');
  await page
    .getByLabel('Affirmations soutenues (une par ligne)')
    .fill('Une promesse agrégée ne remplace pas une annulation.');
  await page.getByLabel('Sources manquantes').uncheck();
  await page.getByRole('button', { name: 'Enregistrer & publier' }).click();
  await expect(page.getByRole('status')).toContainText('Version publiée');
  const editorUrl = page.url();
  await page.goto(`/posts/${slug}`);
  await expect(page.getByRole('heading', { name: 'Une vérification éditoriale temporaire' })).toBeVisible();
  await page.goto(editorUrl);
  await page.getByRole('button', { name: 'Archiver', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Contenu archivé');
  // Suppression physique réservée aux fixtures tests via SQL; le produit archive et conserve l'audit.
});
test('mobile 360 px, clavier, code et carrousel sans débordement global', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(process.env.OWNER_EMAIL!);
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.OWNER_PASSWORD!);
  await page.getByRole('button', { name: 'Entrer dans mon espace' }).click();
  await expect(page).toHaveURL(/\/feed/);
  await expect(page.locator('.post-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await expect(page.getByRole('navigation', { name: 'Navigation mobile' })).toBeVisible();
  await page.goto('/explore');
  await page.locator('#format').selectOption('carousel');
  await expect(page.locator('.carousel-controls').first()).toBeVisible();
  await page.locator('.carousel-controls').first().getByRole('button', { name: 'Carte suivante' }).click();
  await expect(page.locator('.slide-label').first()).toContainText('CARTE 2');
  await page.locator('#format').selectOption('code');
  await expect(page.locator('.code-block').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await page.keyboard.press('Tab');
  await page.screenshot({ path: '.local/mobile-explore.png', fullPage: false });
  await page.goto('/feed');
  await expect(page.locator('.post-card').first()).toBeVisible();
  await page.screenshot({ path: '.local/mobile-feed.png', fullPage: false });
});
test('assistant sans clé explicite et aucune génération à la lecture', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Adresse email').fill(process.env.OWNER_EMAIL!);
  await page.getByLabel('Mot de passe', { exact: true }).fill(process.env.OWNER_PASSWORD!);
  await page.getByRole('button', { name: 'Entrer dans mon espace' }).click();
  await expect(page).toHaveURL(/\/feed/);
  await page.goto('/admin/generation');
  await expect(page.getByText('Mode sans clé IA — le fil reste disponible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réserver le budget & lancer' })).toBeDisabled();
});
