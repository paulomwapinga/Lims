/*
  # Add Report Aggregate Functions

  1. New Functions
    - `get_sales_summary(start_date, end_date)`: Returns total revenue, visit count, test revenue, medicine revenue
    - `get_top_tests(start_date, end_date, limit_count)`: Returns top tests by revenue
    - `get_top_medicines(start_date, end_date, limit_count)`: Returns top medicines by revenue
    - `get_low_stock_items()`: Returns all items where qty_on_hand <= reorder_level
    - `get_top_suppliers(start_date, end_date, limit_count)`: Returns top suppliers by purchase amount
    - `get_profit_summary(start_date, end_date)`: Returns profit/COGS breakdown
    - `get_top_profitable_tests(start_date, end_date, limit_count)`: Returns most profitable tests
    - `get_top_profitable_medicines(start_date, end_date, limit_count)`: Returns most profitable medicines

  These replace client-side aggregate computations that were subject to the PostgREST 1000-row cap.
*/

CREATE OR REPLACE FUNCTION get_sales_summary(start_date text, end_date text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(v.total), 0),
    'visit_count', COUNT(v.id),
    'test_revenue', COALESCE((
      SELECT SUM(vt.price * vt.qty)
      FROM visit_tests vt
      JOIN visits vs ON vt.visit_id = vs.id
      WHERE vs.created_at >= start_date::timestamptz
        AND vs.created_at <= (end_date || 'T23:59:59')::timestamptz
    ), 0),
    'medicine_revenue', COALESCE((
      SELECT SUM(vm.price * vm.qty)
      FROM visit_medicines vm
      JOIN visits vs ON vm.visit_id = vs.id
      WHERE vs.created_at >= start_date::timestamptz
        AND vs.created_at <= (end_date || 'T23:59:59')::timestamptz
    ), 0)
  ) INTO result
  FROM visits v
  WHERE v.created_at >= start_date::timestamptz
    AND v.created_at <= (end_date || 'T23:59:59')::timestamptz;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION get_top_tests(start_date text, end_date text, limit_count int DEFAULT 5)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      ts.name,
      SUM(vt.qty) AS count,
      SUM(vt.price * vt.qty) AS revenue
    FROM visit_tests vt
    JOIN tests ts ON vt.test_id = ts.id
    JOIN visits v ON vt.visit_id = v.id
    WHERE v.created_at >= start_date::timestamptz
      AND v.created_at <= (end_date || 'T23:59:59')::timestamptz
    GROUP BY ts.id, ts.name
    ORDER BY revenue DESC
    LIMIT limit_count
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION get_top_medicines(start_date text, end_date text, limit_count int DEFAULT 5)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      ii.name,
      SUM(vm.qty) AS qty,
      SUM(vm.price * vm.qty) AS revenue
    FROM visit_medicines vm
    JOIN inventory_items ii ON vm.item_id = ii.id
    JOIN visits v ON vm.visit_id = v.id
    WHERE v.created_at >= start_date::timestamptz
      AND v.created_at <= (end_date || 'T23:59:59')::timestamptz
    GROUP BY ii.id, ii.name
    ORDER BY revenue DESC
    LIMIT limit_count
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION get_low_stock_items()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT name, qty_on_hand AS qty, reorder_level AS reorder, type
    FROM inventory_items
    WHERE qty_on_hand <= reorder_level
    ORDER BY (qty_on_hand - reorder_level) ASC
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION get_top_suppliers(start_date text, end_date text, limit_count int DEFAULT 5)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      COALESCE(supplier, 'Unknown') AS supplier,
      SUM(total_amount) AS amount,
      COUNT(*) AS count
    FROM purchases
    WHERE purchase_date >= start_date::timestamptz
      AND purchase_date <= (end_date || 'T23:59:59')::timestamptz
      AND status = 'completed'
    GROUP BY supplier
    ORDER BY amount DESC
    LIMIT limit_count
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION get_profit_summary(start_date text, end_date text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_total_revenue numeric;
  v_test_revenue numeric;
  v_test_cogs numeric;
  v_medicine_revenue numeric;
  v_medicine_cogs numeric;
BEGIN
  SELECT COALESCE(SUM(paid), 0) INTO v_total_revenue
  FROM visits
  WHERE created_at >= start_date::timestamptz
    AND created_at <= (end_date || 'T23:59:59')::timestamptz;

  SELECT
    COALESCE(SUM(vt.price * vt.qty), 0),
    COALESCE(SUM(
      (SELECT COALESCE(SUM(tc.quantity * ii.cost_price), 0)
       FROM test_consumables tc
       JOIN inventory_items ii ON tc.item_id = ii.id
       WHERE tc.test_id = vt.test_id) * vt.qty
    ), 0)
  INTO v_test_revenue, v_test_cogs
  FROM visit_tests vt
  JOIN visits v ON vt.visit_id = v.id
  WHERE v.created_at >= start_date::timestamptz
    AND v.created_at <= (end_date || 'T23:59:59')::timestamptz;

  SELECT
    COALESCE(SUM(vm.price * vm.qty), 0),
    COALESCE(SUM(ii.cost_price * vm.qty), 0)
  INTO v_medicine_revenue, v_medicine_cogs
  FROM visit_medicines vm
  JOIN inventory_items ii ON vm.item_id = ii.id
  JOIN visits v ON vm.visit_id = v.id
  WHERE v.created_at >= start_date::timestamptz
    AND v.created_at <= (end_date || 'T23:59:59')::timestamptz;

  SELECT json_build_object(
    'total_revenue', v_total_revenue,
    'gross_profit', v_total_revenue - v_test_cogs - v_medicine_cogs,
    'profit_margin', CASE WHEN v_total_revenue > 0 THEN ((v_total_revenue - v_test_cogs - v_medicine_cogs) / v_total_revenue * 100) ELSE 0 END,
    'test_revenue', v_test_revenue,
    'test_cogs', v_test_cogs,
    'test_profit', v_test_revenue - v_test_cogs,
    'test_profit_margin', CASE WHEN v_test_revenue > 0 THEN ((v_test_revenue - v_test_cogs) / v_test_revenue * 100) ELSE 0 END,
    'medicine_revenue', v_medicine_revenue,
    'medicine_cogs', v_medicine_cogs,
    'medicine_profit', v_medicine_revenue - v_medicine_cogs,
    'medicine_profit_margin', CASE WHEN v_medicine_revenue > 0 THEN ((v_medicine_revenue - v_medicine_cogs) / v_medicine_revenue * 100) ELSE 0 END
  ) INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION get_top_profitable_tests(start_date text, end_date text, limit_count int DEFAULT 5)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      ts.name,
      SUM(vt.price * vt.qty) AS revenue,
      SUM(
        (SELECT COALESCE(SUM(tc.quantity * ii.cost_price), 0)
         FROM test_consumables tc
         JOIN inventory_items ii ON tc.item_id = ii.id
         WHERE tc.test_id = vt.test_id) * vt.qty
      ) AS cost,
      SUM(vt.price * vt.qty) - SUM(
        (SELECT COALESCE(SUM(tc.quantity * ii.cost_price), 0)
         FROM test_consumables tc
         JOIN inventory_items ii ON tc.item_id = ii.id
         WHERE tc.test_id = vt.test_id) * vt.qty
      ) AS profit,
      SUM(vt.qty) AS count
    FROM visit_tests vt
    JOIN tests ts ON vt.test_id = ts.id
    JOIN visits v ON vt.visit_id = v.id
    WHERE v.created_at >= start_date::timestamptz
      AND v.created_at <= (end_date || 'T23:59:59')::timestamptz
    GROUP BY ts.id, ts.name
    ORDER BY profit DESC
    LIMIT limit_count
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION get_top_profitable_medicines(start_date text, end_date text, limit_count int DEFAULT 5)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_to_json(t)) INTO result
  FROM (
    SELECT
      ii.name,
      SUM(vm.price * vm.qty) AS revenue,
      SUM(ii.cost_price * vm.qty) AS cost,
      SUM((vm.price - ii.cost_price) * vm.qty) AS profit,
      SUM(vm.qty) AS qty
    FROM visit_medicines vm
    JOIN inventory_items ii ON vm.item_id = ii.id
    JOIN visits v ON vm.visit_id = v.id
    WHERE v.created_at >= start_date::timestamptz
      AND v.created_at <= (end_date || 'T23:59:59')::timestamptz
    GROUP BY ii.id, ii.name
    ORDER BY profit DESC
    LIMIT limit_count
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;
