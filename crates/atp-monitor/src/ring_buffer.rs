use std::collections::VecDeque;

#[derive(Debug, Clone)]
pub struct RingBuffer<T> {
    buffer: VecDeque<T>,
    capacity: usize,
}

impl<T: Clone> RingBuffer<T> {
    pub fn new(capacity: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    pub fn push(&mut self, item: T) {
        if self.buffer.len() >= self.capacity {
            self.buffer.pop_front();
        }
        self.buffer.push_back(item);
    }

    pub fn latest(&self) -> Option<&T> {
        self.buffer.back()
    }

    pub fn history(&self, limit: usize) -> Vec<T> {
        let count = limit.min(self.buffer.len());
        self.buffer
            .iter()
            .skip(self.buffer.len().saturating_sub(count))
            .cloned()
            .collect()
    }

    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_fifo_and_capacity() {
        let mut rb = RingBuffer::new(3);
        assert_eq!(rb.len(), 0);
        assert!(rb.is_empty());

        rb.push(10);
        rb.push(20);
        rb.push(30);
        assert_eq!(rb.len(), 3);
        assert_eq!(rb.latest(), Some(&30));
        assert_eq!(rb.history(5), vec![10, 20, 30]);

        // Overflow: 10 evicted, 40 added
        rb.push(40);
        assert_eq!(rb.len(), 3);
        assert_eq!(rb.latest(), Some(&40));
        assert_eq!(rb.history(5), vec![20, 30, 40]);

        // Limited history
        assert_eq!(rb.history(2), vec![30, 40]);
    }
}
