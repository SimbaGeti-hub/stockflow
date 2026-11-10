import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { ApiError, request } from '../lib/api'
import type { Category, Product } from '../lib/types'
import { TextField } from '../ui/TextField'
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '../ui/classes'

type FormValues = {
  name: string
  sku: string
  barcode: string
  description: string
  categoryId: string
  costPrice: string
  sellingPrice: string
  taxRate: string
  reorderThreshold: string
  openingStock: string
}

function initialValues(product?: Product): FormValues {
  return {
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? '',
    description: product?.description ?? '',
    categoryId: product?.categoryId ?? '',
    costPrice: typeof product?.costPrice === 'number' ? String(product.costPrice) : '',
    sellingPrice: product ? String(product.sellingPrice) : '',
    taxRate: product ? String(product.taxRate) : '0',
    reorderThreshold: product ? String(product.reorderThreshold) : '0',
    openingStock: '',
  }
}

function toNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value)
}

function ProductForm({ product }: { product?: Product }) {
  const { can } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [values, setValues] = useState<FormValues>(() => initialValues(product))
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Remembers a product that was saved even if the opening stock step failed.
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const [categoryBusy, setCategoryBusy] = useState(false)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => request<Category[]>('/categories'),
  })

  function set(field: keyof FormValues) {
    return (value: string) => setValues((current) => ({ ...current, [field]: value }))
  }

  async function addCategory() {
    const name = newCategory.trim()
    if (!name) return
    setCategoryBusy(true)
    setCategoryError(null)
    try {
      const created = await request<Category>('/categories', { method: 'POST', body: { name } })
      await queryClient.invalidateQueries({ queryKey: ['categories'] })
      set('categoryId')(created.id)
      setNewCategory('')
    } catch (e) {
      setCategoryError(e instanceof ApiError ? e.message : 'Could not add the category.')
    } finally {
      setCategoryBusy(false)
    }
  }

  function onCategoryKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      void addCategory()
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setFieldErrors({})

    const body = {
      name: values.name,
      sku: values.sku,
      barcode: values.barcode,
      description: values.description,
      categoryId: values.categoryId || undefined,
      costPrice: toNumber(values.costPrice),
      sellingPrice: toNumber(values.sellingPrice),
      taxRate: toNumber(values.taxRate) ?? 0,
      reorderThreshold: toNumber(values.reorderThreshold) ?? 0,
    }

    let productSaved = false
    try {
      if (product) {
        await request<Product>(`/products/${product.id}`, { method: 'PUT', body })
      } else {
        let newId = createdId
        if (!newId) {
          const created = await request<Product>('/products', { method: 'POST', body })
          newId = created.id
          setCreatedId(newId)
        }
        productSaved = true
        const opening = toNumber(values.openingStock)
        if (opening !== undefined && opening > 0 && can('inventory:adjust')) {
          await request('/inventory/receipts', {
            method: 'POST',
            body: { notes: 'Opening stock', items: [{ productId: newId, quantity: opening }] },
          })
        }
      }
      await queryClient.invalidateQueries()
      navigate('/products')
    } catch (e) {
      if (!(e instanceof ApiError)) {
        setError('Could not save. Check your connection and try again.')
      } else if (productSaved) {
        setError(`The product was saved, but the opening stock failed: ${e.message} Press Save to try the stock again.`)
      } else {
        setError(e.message)
        setFieldErrors(e.fieldErrors)
      }
    } finally {
      setBusy(false)
    }
  }

  async function archive() {
    if (!product) return
    const confirmed = window.confirm(
      `Archive ${product.name}? It leaves sales and stock lists. You can restore it from the Products page.`,
    )
    if (!confirmed) return
    setBusy(true)
    setError(null)
    try {
      await request<Product>(`/products/${product.id}/archive`, { method: 'POST' })
      await queryClient.invalidateQueries()
      navigate('/products')
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not archive the product.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{product ? 'Edit product' : 'New product'}</h1>
        <p className="mt-1 text-sm text-muted">Fields marked * are required.</p>
      </div>

      <form onSubmit={onSubmit} className={cardClass + ' max-w-2xl space-y-4'} noValidate>
        <TextField id="name" label="Product name" required value={values.name} onChange={set('name')} error={fieldErrors['name']} />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="sku"
            label="SKU"
            required
            value={values.sku}
            onChange={set('sku')}
            error={fieldErrors['sku']}
            hint="A short unique code. Capital letters are applied automatically."
          />
          <TextField
            id="barcode"
            label="Barcode (optional)"
            value={values.barcode}
            onChange={set('barcode')}
            error={fieldErrors['barcode']}
          />
        </div>

        <div>
          <label htmlFor="categoryId" className={labelClass}>
            Category
          </label>
          <select
            id="categoryId"
            className={inputClass}
            value={values.categoryId}
            onChange={(e) => set('categoryId')(e.target.value)}
          >
            <option value="">No category</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          {can('categories:write') && (
            <div className="mt-2 flex gap-2">
              <input
                aria-label="New category name"
                placeholder="Or add a new category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={onCategoryKeyDown}
                className={inputClass}
              />
              <button
                type="button"
                className={secondaryButtonClass}
                disabled={categoryBusy || newCategory.trim() === ''}
                onClick={() => void addCategory()}
              >
                Add
              </button>
            </div>
          )}
          {categoryError && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {categoryError}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="costPrice"
            label="Cost price"
            required
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={values.costPrice}
            onChange={set('costPrice')}
            error={fieldErrors['costPrice']}
          />
          <TextField
            id="sellingPrice"
            label="Selling price"
            required
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={values.sellingPrice}
            onChange={set('sellingPrice')}
            error={fieldErrors['sellingPrice']}
            hint="Tax is added on top of this price at checkout."
          />
          <TextField
            id="taxRate"
            label="Tax rate (%)"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={values.taxRate}
            onChange={set('taxRate')}
            error={fieldErrors['taxRate']}
          />
          <TextField
            id="reorderThreshold"
            label="Reorder level"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={values.reorderThreshold}
            onChange={set('reorderThreshold')}
            error={fieldErrors['reorderThreshold']}
            hint="You are warned when stock falls to this number."
          />
        </div>

        {!product && can('inventory:adjust') && (
          <TextField
            id="openingStock"
            label="Opening stock (optional)"
            type="number"
            inputMode="decimal"
            step="any"
            min="0"
            value={values.openingStock}
            onChange={set('openingStock')}
            hint="How many you have right now. It is recorded in the stock history."
          />
        )}

        <div>
          <label htmlFor="description" className={labelClass}>
            Description (optional)
          </label>
          <textarea
            id="description"
            rows={3}
            maxLength={2000}
            value={values.description}
            onChange={(e) => set('description')(e.target.value)}
            className={inputClass}
          />
          {fieldErrors['description'] && (
            <p className="mt-1 text-sm text-danger">{fieldErrors['description']}</p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy} className={primaryButtonClass}>
            {busy ? 'Saving...' : 'Save product'}
          </button>
          <Link to="/products" className={secondaryButtonClass}>
            Cancel
          </Link>
          {product && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void archive()}
              className={secondaryButtonClass + ' ml-auto text-danger'}
            >
              Archive
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

export default function ProductFormPage() {
  const { id } = useParams()
  const { can } = useAuth()
  const editing = id !== undefined

  const { data: product, isPending, isError, error } = useQuery({
    queryKey: ['product', id],
    queryFn: () => request<Product>(`/products/${id}`),
    enabled: editing,
  })

  if (!can('products:write')) {
    return <p className="text-sm text-muted">You do not have permission to manage products.</p>
  }
  if (editing && isPending) {
    return <p className="text-sm text-muted">Loading product...</p>
  }
  if (editing && (isError || !product)) {
    return (
      <p role="alert" className="text-sm text-danger">
        {error instanceof Error ? error.message : 'Could not load the product.'}
      </p>
    )
  }
  return <ProductForm key={product?.id ?? 'new'} product={product} />
}
